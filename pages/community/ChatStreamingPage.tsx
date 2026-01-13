import React, { useState } from "react";
import { Button, Input, List, Alert } from "antd";

const mockMessages = [
  { user: "Ana", text: "¡Hola a todos!" },
  { user: "Luis", text: "¿Alguien va al streaming del evento?" },
];

export default function ChatStreamingPage() {
  const [messages, setMessages] = useState(mockMessages);
  const [input, setInput] = useState("");
  const [streamUrl] = useState("https://www.youtube.com/embed/dQw4w9WgXcQ");

  const handleSend = () => {
    if (input.trim()) {
      setMessages([...messages, { user: "Tú", text: input }]);
      setInput("");
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: "2rem auto" }}>
      <h2>Streaming en vivo</h2>
      <div style={{ marginBottom: 24 }}>
        <iframe
          width="100%"
          height="400"
          src={streamUrl}
          title="Streaming"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        ></iframe>
      </div>
      <h3>Chat del evento</h3>
      <List
        bordered
        dataSource={messages}
        renderItem={msg => (
          <List.Item>
            <strong>{msg.user}:</strong> {msg.text}
          </List.Item>
        )}
        style={{ marginBottom: 16, maxHeight: 200, overflowY: "auto" }}
      />
      <Input.Group compact>
        <Input
          style={{ width: "80%" }}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Escribe tu mensaje..."
        />
        <Button type="primary" onClick={handleSend}>
          Enviar
        </Button>
      </Input.Group>
      <Alert type="info" message="Esta es una demo. El streaming y chat real se conectarán a los servicios en la siguiente fase." style={{ marginTop: 24 }} />
    </div>
  );
}
