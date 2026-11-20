import { createServer } from "node:http";
type Message = {
  mobile: string;
  templateId: number;
  parameters: Array<{ name: string; value: string }>;
};
let messages: Message[] = [];
const server = createServer(async (req, res) => {
  res.setHeader("content-type", "application/json");
  if (req.url === "/health") {
    res.end('{"ok":true}');
    return;
  }
  if (req.url === "/messages") {
    if (req.method === "DELETE") messages = [];
    res.end(JSON.stringify(messages));
    return;
  }
  if (req.url === "/send" && req.method === "POST") {
    let data = "";
    for await (const chunk of req) data += chunk;
    const body = JSON.parse(data);
    messages.push(body);
    res.end(
      JSON.stringify({
        status: 1,
        message: "Sent by isolated test provider",
        data: { messageId: messages.length },
      }),
    );
    return;
  }
  res.statusCode = 404;
  res.end("{}");
});
server.listen(3101, "127.0.0.1");
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => server.close());
