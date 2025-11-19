// src/index.js

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return serveChatPage();
    }

    if (request.method === "POST" && url.pathname === "/api/chat") {
      return handleChatRequest(request, env, ctx);
    }

    return new Response("Not found", { status: 404 });
  }
};

/**
 * Return a simple HTML page with a chat interface.
 */
function serveChatPage() {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Aakash's Cloudflare AI Chat</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 1.5rem;
      background: #f5f5f5;
    }
    h1 {
      font-size: 1.6rem;
      margin-bottom: 0.5rem;
    }
    #chat {
      border: 1px solid #ccc;
      border-radius: 0.5rem;
      padding: 1rem;
      background: #fff;
      height: 400px;
      overflow-y: auto;
      margin-bottom: 1rem;
      white-space: pre-wrap;
    }
    .message {
      margin-bottom: 0.75rem;
      padding: 0.3rem 0.5rem;
      border-radius: 0.4rem;
    }
    .user {
      font-weight: bold;
      color: #1a73e8;
    }
    .assistant {
      font-weight: bold;
      color: #0b8043;
    }
    .bubble-user {
      background: #e8f1ff;
      align-self: flex-end;
    }
    .bubble-assistant {
      background: #e8f5e9;
      align-self: flex-start;
    }
    .toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .toolbar-left,
    .toolbar-right {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    select {
      padding: 0.25rem 0.5rem;
      font-size: 0.9rem;
    }
    #status {
      font-size: 0.85rem;
      color: #555;
    }
    form {
      display: flex;
      gap: 0.5rem;
      align-items: flex-end;
    }
    textarea {
      flex: 1;
      resize: vertical;
      min-height: 60px;
      font-family: inherit;
      padding: 0.5rem;
    }
    button {
      padding: 0.5rem 0.7rem;
      font-size: 0.95rem;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.7;
      cursor: default;
    }
    .hint {
      font-size: 0.8rem;
      color: #666;
      margin-top: 0.4rem;
    }
  </style>
</head>
<body>
  <h1>Aakash's AI Chat on Cloudflare</h1>
  <p>This is a demo chat app using Cloudflare Workers AI with Llama 3.3 and KV memory.</p>

  <div class="toolbar">
    <div class="toolbar-left">
      <label for="mode">Assistant mode:</label>
      <select id="mode">
        <option value="general" selected>General</option>
        <option value="tutor">Tutor</option>
        <option value="coding">Coding helper</option>
        <option value="concise">Extra concise</option>
      </select>
    </div>
    <div class="toolbar-right">
      <button type="button" id="clear">Clear chat</button>
      <span id="status">Ready</span>
    </div>
  </div>

  <div id="chat"></div>

  <form id="chat-form">
    <textarea id="input" placeholder="Type a message. Enter to send, Shift+Enter for a new line."></textarea>
    <button type="submit" id="send">Send</button>
  </form>
  <div class="hint">
    Enter sends the message, Shift+Enter adds a new line.
  </div>

  <script>
    // Session id so the Worker can remember this conversation.
    let sessionId = localStorage.getItem("cfchat_session_id");
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem("cfchat_session_id", sessionId);
    }

    const chatDiv = document.getElementById("chat");
    const form = document.getElementById("chat-form");
    const input = document.getElementById("input");
    const sendButton = document.getElementById("send");
    const clearButton = document.getElementById("clear");
    const statusSpan = document.getElementById("status");
    const modeSelect = document.getElementById("mode");

    function appendMessage(role, text) {
      const wrapper = document.createElement("div");
      wrapper.className = "message " + (role === "user" ? "bubble-user" : "bubble-assistant");

      if (role === "user") {
        wrapper.innerHTML = '<span class="user">You:</span> ' + text;
      } else {
        wrapper.innerHTML = '<span class="assistant">Assistant:</span> ' + text;
      }

      chatDiv.appendChild(wrapper);
      chatDiv.scrollTop = chatDiv.scrollHeight;
    }

    function setLoading(isLoading) {
      if (isLoading) {
        sendButton.disabled = true;
        clearButton.disabled = true;
        input.disabled = true;
        statusSpan.textContent = "Thinking...";
      } else {
        sendButton.disabled = false;
        clearButton.disabled = false;
        input.disabled = false;
        statusSpan.textContent = "Ready";
        input.focus();
      }
    }

    async function sendMessage(message) {
      if (!message) return;
      appendMessage("user", message);
      input.value = "";
      const mode = modeSelect.value;

      // Placeholder assistant message
      const thinkingNode = document.createElement("div");
      thinkingNode.className = "message bubble-assistant";
      thinkingNode.innerHTML = '<span class="assistant">Assistant:</span> Thinking...';
      chatDiv.appendChild(thinkingNode);
      chatDiv.scrollTop = chatDiv.scrollHeight;

      try {
        setLoading(true);

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, message, mode })
        });

        if (!response.ok) {
          throw new Error("Server returned " + response.status);
        }

        const data = await response.json();
        chatDiv.removeChild(thinkingNode);
        appendMessage("assistant", data.reply || "[No reply]");
      } catch (err) {
        chatDiv.removeChild(thinkingNode);
        appendMessage("assistant", "Sorry, something went wrong. Please try again.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const message = input.value.trim();
      sendMessage(message);
    });

    // Enter to send, Shift+Enter for newline
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        const message = input.value.trim();
        if (message) {
          sendMessage(message);
        }
      }
    });

    // Clear chat and reset session
    clearButton.addEventListener("click", () => {
      chatDiv.innerHTML = "";
      sessionId = crypto.randomUUID();
      localStorage.setItem("cfchat_session_id", sessionId);
      appendMessage("assistant", "Chat cleared. You are now in a new session.");
    });

    // Focus the input on load
    window.addEventListener("load", () => {
      input.focus();
    });
  </script>
</body>
</html>
  `;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
}

/**
 * Handle POST /api/chat
 * Body: { sessionId: string, message: string, mode?: string }
 */
async function handleChatRequest(request, env, ctx) {
  try {
    const { sessionId, message, mode } = await request.json();

    if (!sessionId || !message) {
      return new Response(
        JSON.stringify({ error: "Missing sessionId or message" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const historyKey = "session:" + sessionId;

    // Read previous history from KV
    const stored = await env.CHAT_KV.get(historyKey);
    let history = [];
    if (stored) {
      history = JSON.parse(stored);
    }

    // Add the new user message to history
    history.push({ role: "user", content: message });

    // Use only the recent part of the history for context
    const MAX_CONTEXT_MESSAGES = 8; // recent window for context
    let recentHistory = history;
    if (recentHistory.length > MAX_CONTEXT_MESSAGES) {
      recentHistory = recentHistory.slice(recentHistory.length - MAX_CONTEXT_MESSAGES);
    }

    // Build a prompt that uses context but does not invite fake transcripts
    const prompt = buildPrompt(recentHistory, mode);

    // Call Llama 3 point 3 on Workers AI
    const result = await env.AI.run(
      "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      {
        prompt,
        max_tokens: 120,
        temperature: 0.25
      }
    );

    const reply = result.response;

    // Save assistant reply in full history (for memory)
    history.push({ role: "assistant", content: reply });

    // Keep only a hard cap in KV so it does not grow forever
    const MAX_STORED_MESSAGES = 30;
    if (history.length > MAX_STORED_MESSAGES) {
      history = history.slice(history.length - MAX_STORED_MESSAGES);
    }

    // Store updated history back to KV
    await env.CHAT_KV.put(historyKey, JSON.stringify(history));

    return new Response(JSON.stringify({ reply }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.toString() }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

/**
 * Build a prompt that includes recent context but never invites the model
 * to print a fake conversation transcript.
 */
function buildPrompt(history, mode) {
  let modeInstruction = "";

  switch (mode) {
    case "tutor":
      modeInstruction =
        "You are a patient tutor. Explain ideas clearly and simply.\n";
      break;
    case "coding":
      modeInstruction =
        "You are a helpful coding assistant. Provide short, correct examples.\n";
      break;
    case "concise":
      modeInstruction =
        "You are extremely concise. Reply in one or two short sentences unless the user explicitly asks for detail.\n";
      break;
    case "general":
    default:
      modeInstruction =
        "You are a friendly general purpose assistant.\n";
      break;
  }

  // Separate context from the latest user message
  const latest = history[history.length - 1];
  const previous = history.slice(0, history.length - 1);

  let contextText = "";
  if (previous.length > 0) {
    contextText += "Here is a summary of the recent conversation between you and the user:\n";
    for (const msg of previous) {
      if (msg.role === "user") {
        contextText += "- The user said: " + msg.content + "\n";
      } else if (msg.role === "assistant") {
        contextText += "- You answered: " + msg.content + "\n";
      }
    }
    contextText += "\nUse this context only if it clearly helps answer the latest question.\n\n";
  }

  const latestUser = latest.role === "user" ? latest.content : "";

  const text =
    modeInstruction +
    "Important rules:\n" +
    "1. Answer only the user's latest message.\n" +
    "2. Do not write a script or a transcript.\n" +
    "3. Do not include lines that start with labels like User or Assistant.\n" +
    "4. Keep your reply to at most 2–3 short sentences, unless the user explicitly asks for a detailed explanation, list, or multiple options.\n" +
    "5. Just respond as yourself in a single and coherent answer.\n\n" +
    contextText +
    "The user has now said: \"" +
    latestUser +
    "\"\n\n" +
    "Give your best answer to this latest message.";

  return text;
}
