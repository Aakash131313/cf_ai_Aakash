\# Cloudflare AI Chat – Aakash



This is a simple AI powered chat app built on Cloudflare Workers. It uses Workers AI for the model, a Worker for coordination, a small browser chat UI for input, and Workers KV for memory.



\## Architecture



\### LLM



\- Uses Cloudflare Workers AI model `@cf/meta/llama-3.3-70b-instruct-fp8-fast` for text responses.

\- The Worker calls the model through the AI binding `env.AI.run(...)`.



\### Workflow and coordination



\- A single Worker file at `src/index.js`:

&nbsp; - Serves the chat interface on `GET /`.

&nbsp; - Exposes `POST /api/chat` as a JSON API.

&nbsp; - Reads and writes per session chat history in Workers KV.

&nbsp; - Builds a prompt that includes a short summary of recent messages.

&nbsp; - Calls Workers AI and returns the reply to the frontend.



\### User input (chat)



\- The frontend is plain HTML, CSS, and JavaScript rendered by the Worker.

\- It provides a chat log, text area, send button, and an assistant mode selector.

\- Messages are sent to `/api/chat` with:

&nbsp; - `sessionId` stored in `localStorage` to keep a conversation per browser.

&nbsp; - `message` as the user text.

&nbsp; - `mode` to switch between general, tutor, coding helper, and concise.



\### Memory and state



\- A Workers KV namespace `CHAT\_KV` is bound in `wrangler.jsonc`.

\- Keys look like `session:<sessionId>`.

\- Values are JSON arrays of `{ role, content }` objects.

\- On each request, the Worker:

&nbsp; - Loads the stored history for that session.

&nbsp; - Appends the new user message.

&nbsp; - Uses a recent window of messages to give the model context.

&nbsp; - Stores the updated history back to KV, with a cap so it does not grow without bound.



\## Quality of life features



\- Clear chat button that resets the session id and starts a new conversation.

\- Mode selector to change assistant behavior (general, tutor, coding helper, concise).

\- Enter to send, Shift Enter to add a new line.

\- Loading state and disabled controls while waiting for a reply.

\- Basic error handling that shows a friendly message if something goes wrong.



\## Running locally



```bash

npx wrangler dev



