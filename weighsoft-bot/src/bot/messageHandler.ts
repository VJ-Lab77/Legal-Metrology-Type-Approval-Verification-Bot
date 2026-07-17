import type { Client } from 'whatsapp-web.js';
import { createLogger } from '../logger';
import { isCheckRequest, parseRequest } from '../parser/inputParser';
import { LiveRegister } from '../lookup/register';
import { formatReply } from '../reply/formatter';

const log = createLogger('handler');

/**
 * Attaches the approval-lookup message handler to a WhatsApp client.
 * Only processes messages from groups whose name contains `groupName`.
 * @param client - Initialised whatsapp-web.js client
 * @param liveRegister - Hot-reloadable in-memory register
 * @param groupName - Substring match for the target WhatsApp group name
 */
export function attachMessageHandler(
  client: Client,
  liveRegister: LiveRegister,
  groupName: string
): void {
  client.on('message', async (msg) => {
    try {
      const chat = await msg.getChat();
      if (!chat.isGroup) return;

      const chatName = chat.name ?? '';
      if (!chatName.toLowerCase().includes(groupName.toLowerCase())) return;

      const body = msg.body ?? '';
      if (!isCheckRequest(body)) return;

      const parsed = parseRequest(body);
      if (!parsed) return;

      const result = liveRegister.lookup(parsed);
      const replyText = formatReply(result, parsed);

      await msg.reply(replyText);

      const contact = await msg.getContact();
      const sender = contact.pushname ?? contact.number ?? 'unknown';
      log.info(`Handled request — sender: ${sender}, SA: ${parsed.saNo}, verdict: ${result.status}`);
    } catch (err) {
      log.error('Error handling message:', err);
    }
  });

  log.info(`Message handler attached — listening in groups matching "${groupName}"`);
}
