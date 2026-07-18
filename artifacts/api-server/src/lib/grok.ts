import OpenAI from 'openai';

let _grok: OpenAI | null = null;

function stripQuotes(val: string): string {
  return val.replace(/^["']|["']$/g, '');
}

function getGrokClient(): OpenAI {
  if (!_grok) {
    if (!process.env.GROK_API_KEY) {
      throw new Error('GROK_API_KEY environment variable is not set');
    }
    _grok = new OpenAI({
      apiKey: stripQuotes(process.env.GROK_API_KEY),
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

  const systemPrompt = `You are writing a welcome email on behalf of MSTS, a product delivery company, to a customer who has just been added to a delivery route.
This is NOT a business partnership email — the customer is a buyer who will receive products delivered to them through this route.
Write in a friendly, clear, practical tone — like a delivery service welcoming a new customer.
Output ONLY a valid JSON object with exactly two keys:
"subject" (string) and "html" (string containing simple HTML with <p>, <a>, <strong> tags only, no full document tags like <html>/<body>).
Do not wrap in markdown code blocks.`;

  const linksSection = [
    whatsappGroupLink
      ? `WhatsApp Group Link: ${whatsappGroupLink}`
      : null,
    driveFolderLink
      ? `Google Drive Folder Link: ${driveFolderLink}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  const userPrompt = `Write a welcome email to a new customer named ${buyerName} who has been added to our delivery route "${routeName}" (route code: ${routeCode}).

Context:
- MSTS is a product delivery company
- The customer will be receiving products delivered to them through this route
- This email should feel like a practical, warm onboarding message from a delivery service

${linksSection || ''}

Instructions:
- Address the customer by first name
- Let them know they've been added to the ${routeName} delivery route (mention the route code ${routeCode})
- Briefly explain what to expect: their orders will be delivered through this route
${whatsappGroupLink ? `- Tell them to join the WhatsApp group for delivery updates, schedules, and announcements — include this link clearly: ${whatsappGroupLink}` : '- Do NOT mention any WhatsApp group'}
${driveFolderLink ? `- Tell them they can find delivery-related documents (invoices, schedules, etc.) in the shared Google Drive folder — include this link: ${driveFolderLink}` : '- Do NOT mention any Drive folder'}
- Keep it short: 3 paragraphs max
- Tone: helpful, practical, friendly — not corporate or formal
- Close with "MSTS Operations Team"
- Subject line should be specific, e.g. "Welcome to the ${routeName} Delivery Route — Here's What to Expect"`;

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
