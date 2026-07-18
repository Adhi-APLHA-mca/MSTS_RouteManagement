import OpenAI from 'openai';

let _grok: OpenAI | null = null;

function getGrokClient(): OpenAI {
  if (!_grok) {
    if (!process.env.GROK_API_KEY) {
      throw new Error('GROK_API_KEY environment variable is not set');
    }
    _grok = new OpenAI({
      apiKey: process.env.GROK_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }
  return _grok;
}

export interface WelcomeEmailParams {
  routeName: string;
  routeCode: string;
  buyerName: string;
  whatsappGroupLink?: string | null;
  driveFolderLink?: string | null;
}

export async function generateWelcomeEmail(
  params: WelcomeEmailParams,
): Promise<{ subject: string; html: string }> {
  const { routeName, routeCode, buyerName, whatsappGroupLink, driveFolderLink } = params;

  const systemPrompt = `You are writing a friendly, professional welcome email to a new transport route buyer.
Write in a warm but concise style. Output ONLY a valid JSON object with exactly two keys:
"subject" (string) and "html" (string containing simple HTML with <p>, <a>, <strong> tags only, no full document tags like <html>/<body>).
Do not wrap in markdown code blocks.`;

  const linksSection = [
    whatsappGroupLink
      ? `WhatsApp Group: ${whatsappGroupLink}`
      : null,
    driveFolderLink
      ? `Google Drive Folder: ${driveFolderLink}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  const userPrompt = `Write a welcome email for a new buyer joining route "${routeName}" (code: ${routeCode}).
Buyer's name: ${buyerName}

${linksSection || 'No resource links available for this route yet.'}

Instructions:
- Greet the buyer warmly by first name
- Welcome them to the ${routeName} route
${whatsappGroupLink ? '- Mention the WhatsApp group and include the link with a clear call-to-action button or anchor' : '- Do NOT mention any WhatsApp group'}
${driveFolderLink ? '- Mention the shared Google Drive folder and include the link; say they now have view access' : '- Do NOT mention any Drive folder'}
- Keep it 3–4 short paragraphs
- Close with "MSTS Operations Team"`;

  const resp = await getGrokClient().chat.completions.create({
    model: 'openai/gpt-oss-120b',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.6,
  });

  const content = resp.choices[0]?.message?.content?.trim() ?? '';

  try {
    const parsed = JSON.parse(content);
    return { subject: String(parsed.subject), html: String(parsed.html) };
  } catch {
    // Graceful fallback if Grok returns non-JSON
    return {
      subject: `Welcome to ${routeName}!`,
      html: `<p>Dear ${buyerName},</p><p>Welcome to the <strong>${routeName}</strong> (${routeCode}) route!${whatsappGroupLink ? ` Join our WhatsApp group: <a href="${whatsappGroupLink}">${whatsappGroupLink}</a>` : ''}${driveFolderLink ? ` Access the shared drive: <a href="${driveFolderLink}">${driveFolderLink}</a>` : ''}</p><p>MSTS Operations Team</p>`,
    };
  }
}
