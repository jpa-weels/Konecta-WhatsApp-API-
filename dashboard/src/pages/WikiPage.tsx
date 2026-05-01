import { useState, useRef } from "react";
import { DEFAULT_API_URL } from "@/config";
import {
  BookOpen,
  Terminal,
  Key,
  Smartphone,
  MessageSquare,
  ChevronRight,
  Copy,
  Check,
  Zap,
  Circle,
  Webhook,
  BarChart3,
} from "lucide-react";
import { cn, copyToClipboard } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Lang = "curl" | "nodejs" | "python" | "php" | "go";

interface Endpoint {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  description: string;
  body?: string;
  response: string;
  codes: Record<Lang, string>;
}

// ─── Code Block ───────────────────────────────────────────────────────────────

const LANG_LABELS: Record<Lang, string> = {
  curl: "cURL",
  nodejs: "Node.js",
  python: "Python",
  php: "PHP",
  go: "Go",
};

function CodeBlock({ codes }: { codes: Record<Lang, string> }) {
  const [lang, setLang] = useState<Lang>("curl");
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await copyToClipboard(codes[lang]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl overflow-hidden border border-border/50 bg-[#0d0d0d]">
      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-border/30 bg-[#111111] px-1">
        <div className="flex">
          {(Object.keys(LANG_LABELS) as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={cn(
                "px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest transition-colors",
                lang === l
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {LANG_LABELS[l]}
            </button>
          ))}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 mr-1 rounded-lg text-[10px] font-bold text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
        >
          {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
          {copied ? "Copiado!" : "Copiar"}
        </button>
      </div>
      {/* Code */}
      <pre className="p-5 text-xs leading-relaxed overflow-x-auto custom-scrollbar font-mono text-[#e2e8f0] whitespace-pre">
        {codes[lang]}
      </pre>
    </div>
  );
}

// ─── Method Badge ─────────────────────────────────────────────────────────────

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-sky-500/20 text-sky-400 border-sky-500/30",
  POST: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  PUT: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  DELETE: "bg-red-500/20 text-red-400 border-red-500/30",
};

function MethodBadge({ method }: { method: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-lg border text-[10px] font-black tracking-widest uppercase",
        METHOD_COLORS[method] ?? "bg-secondary text-foreground"
      )}
    >
      {method}
    </span>
  );
}

// ─── Endpoint Card ─────────────────────────────────────────────────────────────

function EndpointCard({ endpoint }: { endpoint: Endpoint }) {
  return (
    <div className="space-y-4 p-5 rounded-2xl bg-card/40 border border-border/40">
      <div className="flex items-center gap-3 flex-wrap">
        <MethodBadge method={endpoint.method} />
        <code className="text-sm font-mono text-foreground/90 bg-muted/30 px-3 py-1 rounded-lg border border-border/40">
          /api/v1{endpoint.path}
        </code>
      </div>
      <p className="text-sm text-muted-foreground">{endpoint.description}</p>

      {endpoint.body && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
            Request Body
          </p>
          <pre className="text-xs font-mono text-emerald-300/80 bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-4 overflow-x-auto custom-scrollbar whitespace-pre">
            {endpoint.body}
          </pre>
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
          Response
        </p>
        <pre className="text-xs font-mono text-sky-300/80 bg-sky-500/5 border border-sky-500/10 rounded-xl p-4 overflow-x-auto custom-scrollbar whitespace-pre">
          {endpoint.response}
        </pre>
      </div>

      <div className="space-y-1.5">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
          Exemplos de Código
        </p>
        <CodeBlock codes={endpoint.codes} />
      </div>
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({
  id,
  icon: Icon,
  title,
  children,
}: {
  id: string;
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="space-y-6 scroll-mt-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <Icon size={18} />
        </div>
        <h2 className="text-xl font-black tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const BASE = DEFAULT_API_URL;
const KEY = "sua_api_key";

const SESSIONS: Endpoint[] = [
  {
    method: "POST",
    path: "/sessions",
    description: "Cria uma nova sessão WhatsApp. Após criada, use o endpoint de QR para obter o código de vinculação.",
    body: `{
  "sessionId": "minha-sessao",   // opcional — gera UUID se omitido
  "name":      "Atendimento",    // opcional — nome amigável da sessão
  "webhookUrl": "https://..."    // opcional — URL para receber eventos
}`,
    response: `{
  "sessionId": "minha-sessao",
  "message": "Sessão criada, aguarde o QR code"
}`,
    codes: {
      curl: `curl -X POST ${BASE}/api/v1/sessions \\
  -H "X-API-Key: ${KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{"sessionId": "minha-sessao"}'`,
      nodejs: `const res = await fetch('${BASE}/api/v1/sessions', {
  method: 'POST',
  headers: {
    'X-API-Key': '${KEY}',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ sessionId: 'minha-sessao' }),
});
const data = await res.json();
console.log(data);
// { sessionId: 'minha-sessao', message: 'Sessão criada...' }`,
      python: `import requests

response = requests.post(
    '${BASE}/api/v1/sessions',
    headers={'X-API-Key': '${KEY}'},
    json={'sessionId': 'minha-sessao'}
)
print(response.json())
# {'sessionId': 'minha-sessao', 'message': 'Sessão criada...'}`,
      php: `<?php
$ch = curl_init('${BASE}/api/v1/sessions');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => [
        'X-API-Key: ${KEY}',
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => json_encode(['sessionId' => 'minha-sessao']),
]);
$data = json_decode(curl_exec($ch), true);
print_r($data);`,
      go: `package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
)

func main() {
    body, _ := json.Marshal(map[string]string{
        "sessionId": "minha-sessao",
    })
    req, _ := http.NewRequest("POST", "${BASE}/api/v1/sessions", bytes.NewBuffer(body))
    req.Header.Set("X-API-Key", "${KEY}")
    req.Header.Set("Content-Type", "application/json")

    client := &http.Client{}
    resp, _ := client.Do(req)
    defer resp.Body.Close()

    var result map[string]any
    json.NewDecoder(resp.Body).Decode(&result)
    fmt.Println(result)
}`,
    },
  },
  {
    method: "GET",
    path: "/sessions",
    description: "Lista todas as sessões ativas no servidor com seus respectivos status.",
    response: `{
  "sessions": [
    { "id": "minha-sessao", "status": "connected" },
    { "id": "outra-sessao", "status": "qr_ready" }
  ]
}`,
    codes: {
      curl: `curl ${BASE}/api/v1/sessions \\
  -H "X-API-Key: ${KEY}"`,
      nodejs: `const res = await fetch('${BASE}/api/v1/sessions', {
  headers: { 'X-API-Key': '${KEY}' },
});
const { sessions } = await res.json();
console.log(sessions);`,
      python: `import requests

response = requests.get(
    '${BASE}/api/v1/sessions',
    headers={'X-API-Key': '${KEY}'}
)
print(response.json()['sessions'])`,
      php: `<?php
$ch = curl_init('${BASE}/api/v1/sessions');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => ['X-API-Key: ${KEY}'],
]);
$data = json_decode(curl_exec($ch), true);
print_r($data['sessions']);`,
      go: `req, _ := http.NewRequest("GET", "${BASE}/api/v1/sessions", nil)
req.Header.Set("X-API-Key", "${KEY}")

client := &http.Client{}
resp, _ := client.Do(req)
defer resp.Body.Close()

var result map[string]any
json.NewDecoder(resp.Body).Decode(&result)
fmt.Println(result["sessions"])`,
    },
  },
  {
    method: "GET",
    path: "/sessions/:id/status",
    description: "Retorna o status atual de uma sessão. Possíveis valores: connecting, qr_ready, connected, disconnected.",
    response: `{
  "sessionId": "minha-sessao",
  "status": "connected",
  "phone": "5511999887766"   // presente quando conectado
}`,
    codes: {
      curl: `curl ${BASE}/api/v1/sessions/minha-sessao/status \\
  -H "X-API-Key: ${KEY}"`,
      nodejs: `const res = await fetch('${BASE}/api/v1/sessions/minha-sessao/status', {
  headers: { 'X-API-Key': '${KEY}' },
});
const { status } = await res.json();
// status: 'connected' | 'qr_ready' | 'connecting' | 'disconnected'`,
      python: `import requests

response = requests.get(
    '${BASE}/api/v1/sessions/minha-sessao/status',
    headers={'X-API-Key': '${KEY}'}
)
print(response.json()['status'])
# 'connected'`,
      php: `<?php
$ch = curl_init('${BASE}/api/v1/sessions/minha-sessao/status');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => ['X-API-Key: ${KEY}'],
]);
$data = json_decode(curl_exec($ch), true);
echo $data['status'];`,
      go: `req, _ := http.NewRequest("GET", "${BASE}/api/v1/sessions/minha-sessao/status", nil)
req.Header.Set("X-API-Key", "${KEY}")

resp, _ := (&http.Client{}).Do(req)
defer resp.Body.Close()

var result map[string]any
json.NewDecoder(resp.Body).Decode(&result)
fmt.Println(result["status"])`,
    },
  },
  {
    method: "GET",
    path: "/sessions/:id/qr",
    description: "Retorna o QR code em base64 (data URI) para vinculação. Disponível apenas quando status = qr_ready. Expira em 60 segundos.",
    response: `{
  "sessionId": "minha-sessao",
  "qr": "data:image/png;base64,iVBORw0KGgo..."
}`,
    codes: {
      curl: `curl ${BASE}/api/v1/sessions/minha-sessao/qr \\
  -H "X-API-Key: ${KEY}"`,
      nodejs: `const res = await fetch('${BASE}/api/v1/sessions/minha-sessao/qr', {
  headers: { 'X-API-Key': '${KEY}' },
});
const { qr } = await res.json();

// Exibir no HTML
document.getElementById('qrcode').src = qr;

// Ou salvar como arquivo
const fs = require('fs');
const base64 = qr.replace(/^data:image\\/png;base64,/, '');
fs.writeFileSync('qr.png', Buffer.from(base64, 'base64'));`,
      python: `import requests
import base64

response = requests.get(
    '${BASE}/api/v1/sessions/minha-sessao/qr',
    headers={'X-API-Key': '${KEY}'}
)
qr_data = response.json()['qr']

# Salvar como imagem
header, encoded = qr_data.split(',', 1)
with open('qr.png', 'wb') as f:
    f.write(base64.b64decode(encoded))`,
      php: `<?php
$ch = curl_init('${BASE}/api/v1/sessions/minha-sessao/qr');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => ['X-API-Key: ${KEY}'],
]);
$data = json_decode(curl_exec($ch), true);
$qr   = $data['qr'];

// Exibir no HTML
echo '<img src="' . $qr . '">';`,
      go: `req, _ := http.NewRequest("GET", "${BASE}/api/v1/sessions/minha-sessao/qr", nil)
req.Header.Set("X-API-Key", "${KEY}")

resp, _ := (&http.Client{}).Do(req)
defer resp.Body.Close()

var result map[string]any
json.NewDecoder(resp.Body).Decode(&result)
qr := result["qr"].(string)
fmt.Println("QR:", qr[:30], "...")`,
    },
  },
  {
    method: "DELETE",
    path: "/sessions/:id",
    description: "Desconecta e remove a sessão. Apaga as credenciais salvas — o número precisará escanear o QR novamente.",
    response: `{
  "message": "Sessão desconectada"
}`,
    codes: {
      curl: `curl -X DELETE ${BASE}/api/v1/sessions/minha-sessao \\
  -H "X-API-Key: ${KEY}"`,
      nodejs: `const res = await fetch('${BASE}/api/v1/sessions/minha-sessao', {
  method: 'DELETE',
  headers: { 'X-API-Key': '${KEY}' },
});
const data = await res.json();
console.log(data.message);`,
      python: `import requests

response = requests.delete(
    '${BASE}/api/v1/sessions/minha-sessao',
    headers={'X-API-Key': '${KEY}'}
)
print(response.json()['message'])`,
      php: `<?php
$ch = curl_init('${BASE}/api/v1/sessions/minha-sessao');
curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST  => 'DELETE',
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => ['X-API-Key: ${KEY}'],
]);
$data = json_decode(curl_exec($ch), true);
echo $data['message'];`,
      go: `req, _ := http.NewRequest("DELETE", "${BASE}/api/v1/sessions/minha-sessao", nil)
req.Header.Set("X-API-Key", "${KEY}")

resp, _ := (&http.Client{}).Do(req)
defer resp.Body.Close()

var result map[string]any
json.NewDecoder(resp.Body).Decode(&result)
fmt.Println(result["message"])`,
    },
  },
  {
    method: "POST",
    path: "/sessions/:id/restart",
    description: "Reinicia a sessão sem deslogar. Fecha a conexão WebSocket e reconecta automaticamente — útil para resolver travamentos.",
    response: `{
  "message": "Sessão reiniciada"
}`,
    codes: {
      curl: `curl -X POST ${BASE}/api/v1/sessions/minha-sessao/restart \\
  -H "X-API-Key: ${KEY}"`,
      nodejs: `const res = await fetch('${BASE}/api/v1/sessions/minha-sessao/restart', {
  method: 'POST',
  headers: { 'X-API-Key': '${KEY}' },
});
const data = await res.json();
console.log(data.message);`,
      python: `import requests

response = requests.post(
    '${BASE}/api/v1/sessions/minha-sessao/restart',
    headers={'X-API-Key': '${KEY}'}
)
print(response.json()['message'])`,
      php: `<?php
$ch = curl_init('${BASE}/api/v1/sessions/minha-sessao/restart');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => ['X-API-Key: ${KEY}'],
]);
$data = json_decode(curl_exec($ch), true);
echo $data['message'];`,
      go: `req, _ := http.NewRequest("POST", "${BASE}/api/v1/sessions/minha-sessao/restart", nil)
req.Header.Set("X-API-Key", "${KEY}")

resp, _ := (&http.Client{}).Do(req)
defer resp.Body.Close()

var result map[string]any
json.NewDecoder(resp.Body).Decode(&result)
fmt.Println(result["message"])`,
    },
  },
  {
    method: "PUT",
    path: "/sessions/:id/webhook",
    description: "Atualiza a URL e os eventos de webhook associados a uma sessão específica.",
    body: `{
  "webhookUrl":    "https://meusite.com/webhook",   // obrigatório
  "webhookEvents": ["MESSAGES_UPSERT"]               // opcional — filtra eventos
}`,
    response: `{
  "message": "Webhook atualizado com sucesso!",
  "webhookUrl": "https://meusite.com/webhook",
  "webhookEvents": ["MESSAGES_UPSERT"]
}`,
    codes: {
      curl: `curl -X PUT ${BASE}/api/v1/sessions/minha-sessao/webhook \\
  -H "X-API-Key: ${KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "webhookUrl": "https://meusite.com/webhook",
    "webhookEvents": ["MESSAGES_UPSERT", "CONNECTION_UPDATE"]
  }'`,
      nodejs: `await fetch('${BASE}/api/v1/sessions/minha-sessao/webhook', {
  method: 'PUT',
  headers: {
    'X-API-Key': '${KEY}',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    webhookUrl: 'https://meusite.com/webhook',
    webhookEvents: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
  }),
});`,
      python: `import requests

requests.put(
    '${BASE}/api/v1/sessions/minha-sessao/webhook',
    headers={'X-API-Key': '${KEY}'},
    json={
        'webhookUrl': 'https://meusite.com/webhook',
        'webhookEvents': ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
    }
)`,
      php: `<?php
$ch = curl_init('${BASE}/api/v1/sessions/minha-sessao/webhook');
curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST  => 'PUT',
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => [
        'X-API-Key: ${KEY}',
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'webhookUrl' => 'https://meusite.com/webhook',
        'webhookEvents' => ['MESSAGES_UPSERT'],
    ]),
]);
$data = json_decode(curl_exec($ch), true);
print_r($data);`,
      go: `payload, _ := json.Marshal(map[string]any{
    "webhookUrl":    "https://meusite.com/webhook",
    "webhookEvents": []string{"MESSAGES_UPSERT", "CONNECTION_UPDATE"},
})
req, _ := http.NewRequest("PUT", "${BASE}/api/v1/sessions/minha-sessao/webhook", bytes.NewBuffer(payload))
req.Header.Set("X-API-Key", "${KEY}")
req.Header.Set("Content-Type", "application/json")

resp, _ := (&http.Client{}).Do(req)
defer resp.Body.Close()

var result map[string]any
json.NewDecoder(resp.Body).Decode(&result)
fmt.Println(result["message"])`,
    },
  },
];

const WEBHOOKS: Endpoint[] = [
  {
    method: "GET",
    path: "/webhooks",
    description: "Lista todos os webhooks globais cadastrados, incluindo habilitados e desabilitados.",
    response: `{
  "webhooks": [
    {
      "_id": "abc123",
      "name": "Notificações",
      "url": "https://meusite.com/hook",
      "events": ["MESSAGES_UPSERT"],
      "sessionIds": ["minha-sessao"],
      "enabled": true,
      "createdAt": 1714500000000,
      "updatedAt": 1714500000000
    }
  ]
}`,
    codes: {
      curl: `curl ${BASE}/api/v1/webhooks \\
  -H "X-API-Key: ${KEY}"`,
      nodejs: `const res = await fetch('${BASE}/api/v1/webhooks', {
  headers: { 'X-API-Key': '${KEY}' },
});
const { webhooks } = await res.json();
console.log(webhooks);`,
      python: `import requests

response = requests.get(
    '${BASE}/api/v1/webhooks',
    headers={'X-API-Key': '${KEY}'}
)
print(response.json()['webhooks'])`,
      php: `<?php
$ch = curl_init('${BASE}/api/v1/webhooks');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => ['X-API-Key: ${KEY}'],
]);
$data = json_decode(curl_exec($ch), true);
print_r($data['webhooks']);`,
      go: `req, _ := http.NewRequest("GET", "${BASE}/api/v1/webhooks", nil)
req.Header.Set("X-API-Key", "${KEY}")

resp, _ := (&http.Client{}).Do(req)
defer resp.Body.Close()

var result map[string]any
json.NewDecoder(resp.Body).Decode(&result)
fmt.Println(result["webhooks"])`,
    },
  },
  {
    method: "POST",
    path: "/webhooks",
    description: "Cria um webhook global que dispara para múltiplas sessões e eventos. Diferente do webhook por sessão, este é gerenciado centralmente.",
    body: `{
  "name":       "Notificações",                          // opcional
  "url":        "https://meusite.com/hook",              // obrigatório
  "events":     ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],// obrigatório
  "sessionIds": ["sessao-1", "sessao-2"]                 // obrigatório
}`,
    response: `{
  "id": "abc123"
}`,
    codes: {
      curl: `curl -X POST ${BASE}/api/v1/webhooks \\
  -H "X-API-Key: ${KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Notificações",
    "url": "https://meusite.com/hook",
    "events": ["MESSAGES_UPSERT"],
    "sessionIds": ["minha-sessao"]
  }'`,
      nodejs: `const res = await fetch('${BASE}/api/v1/webhooks', {
  method: 'POST',
  headers: {
    'X-API-Key': '${KEY}',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'Notificações',
    url: 'https://meusite.com/hook',
    events: ['MESSAGES_UPSERT'],
    sessionIds: ['minha-sessao'],
  }),
});
const { id } = await res.json();
console.log('Webhook criado:', id);`,
      python: `import requests

response = requests.post(
    '${BASE}/api/v1/webhooks',
    headers={'X-API-Key': '${KEY}'},
    json={
        'name': 'Notificações',
        'url': 'https://meusite.com/hook',
        'events': ['MESSAGES_UPSERT'],
        'sessionIds': ['minha-sessao'],
    }
)
print('Webhook criado:', response.json()['id'])`,
      php: `<?php
$ch = curl_init('${BASE}/api/v1/webhooks');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => [
        'X-API-Key: ${KEY}',
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'name'       => 'Notificações',
        'url'        => 'https://meusite.com/hook',
        'events'     => ['MESSAGES_UPSERT'],
        'sessionIds' => ['minha-sessao'],
    ]),
]);
$data = json_decode(curl_exec($ch), true);
echo 'Webhook criado: ' . $data['id'];`,
      go: `payload, _ := json.Marshal(map[string]any{
    "name":       "Notificações",
    "url":        "https://meusite.com/hook",
    "events":     []string{"MESSAGES_UPSERT"},
    "sessionIds": []string{"minha-sessao"},
})
req, _ := http.NewRequest("POST", "${BASE}/api/v1/webhooks", bytes.NewBuffer(payload))
req.Header.Set("X-API-Key", "${KEY}")
req.Header.Set("Content-Type", "application/json")

resp, _ := (&http.Client{}).Do(req)
defer resp.Body.Close()

var result map[string]any
json.NewDecoder(resp.Body).Decode(&result)
fmt.Println("Webhook criado:", result["id"])`,
    },
  },
  {
    method: "PUT",
    path: "/webhooks/:id",
    description: "Atualiza um webhook existente. Todos os campos são opcionais — envie apenas o que deseja alterar.",
    body: `{
  "url":        "https://novo-url.com/hook",   // opcional
  "events":     ["MESSAGES_UPSERT"],           // opcional
  "sessionIds": ["sessao-1"],                  // opcional
  "enabled":    false,                         // opcional — pausar/ativar
  "name":       "Novo nome"                    // opcional
}`,
    response: `{
  "message": "Webhook atualizado"
}`,
    codes: {
      curl: `curl -X PUT ${BASE}/api/v1/webhooks/WEBHOOK_ID \\
  -H "X-API-Key: ${KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{"enabled": false}'`,
      nodejs: `await fetch('${BASE}/api/v1/webhooks/WEBHOOK_ID', {
  method: 'PUT',
  headers: {
    'X-API-Key': '${KEY}',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ enabled: false }),
});`,
      python: `import requests

requests.put(
    '${BASE}/api/v1/webhooks/WEBHOOK_ID',
    headers={'X-API-Key': '${KEY}'},
    json={'enabled': False}
)`,
      php: `<?php
$ch = curl_init('${BASE}/api/v1/webhooks/WEBHOOK_ID');
curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST  => 'PUT',
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => [
        'X-API-Key: ${KEY}',
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => json_encode(['enabled' => false]),
]);
$data = json_decode(curl_exec($ch), true);
echo $data['message'];`,
      go: `payload, _ := json.Marshal(map[string]any{"enabled": false})
req, _ := http.NewRequest("PUT", "${BASE}/api/v1/webhooks/WEBHOOK_ID", bytes.NewBuffer(payload))
req.Header.Set("X-API-Key", "${KEY}")
req.Header.Set("Content-Type", "application/json")

resp, _ := (&http.Client{}).Do(req)
defer resp.Body.Close()

var result map[string]any
json.NewDecoder(resp.Body).Decode(&result)
fmt.Println(result["message"])`,
    },
  },
  {
    method: "DELETE",
    path: "/webhooks/:id",
    description: "Remove permanentemente um webhook global.",
    response: `{
  "message": "Webhook removido"
}`,
    codes: {
      curl: `curl -X DELETE ${BASE}/api/v1/webhooks/WEBHOOK_ID \\
  -H "X-API-Key: ${KEY}"`,
      nodejs: `await fetch('${BASE}/api/v1/webhooks/WEBHOOK_ID', {
  method: 'DELETE',
  headers: { 'X-API-Key': '${KEY}' },
});`,
      python: `import requests

requests.delete(
    '${BASE}/api/v1/webhooks/WEBHOOK_ID',
    headers={'X-API-Key': '${KEY}'}
)`,
      php: `<?php
$ch = curl_init('${BASE}/api/v1/webhooks/WEBHOOK_ID');
curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST  => 'DELETE',
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => ['X-API-Key: ${KEY}'],
]);
$data = json_decode(curl_exec($ch), true);
echo $data['message'];`,
      go: `req, _ := http.NewRequest("DELETE", "${BASE}/api/v1/webhooks/WEBHOOK_ID", nil)
req.Header.Set("X-API-Key", "${KEY}")

resp, _ := (&http.Client{}).Do(req)
defer resp.Body.Close()

var result map[string]any
json.NewDecoder(resp.Body).Decode(&result)
fmt.Println(result["message"])`,
    },
  },
];

const ANALYTICS: Endpoint[] = [
  {
    method: "GET",
    path: "/analytics",
    description: "Retorna métricas consolidadas dos últimos 30 dias: totais de mensagens, sessões por status e webhooks ativos.",
    response: `{
  "messages": {
    "total": 1234,
    "inbound": 800,
    "outbound": 434,
    "byDay": { "1714435200": { "inbound": 50, "outbound": 30 } },
    "byType": { "text": 900, "image": 200, "video": 134 },
    "bySession": { "minha-sessao": { "inbound": 500, "outbound": 200 } }
  },
  "sessions": {
    "total": 3,
    "connected": 2,
    "byStatus": { "connected": 2, "disconnected": 1 }
  },
  "webhooks": {
    "total": 5,
    "active": 3,
    "paused": 2,
    "totalEventConfigs": 8
  }
}`,
    codes: {
      curl: `curl ${BASE}/api/v1/analytics \\
  -H "X-API-Key: ${KEY}"`,
      nodejs: `const res = await fetch('${BASE}/api/v1/analytics', {
  headers: { 'X-API-Key': '${KEY}' },
});
const analytics = await res.json();
console.log('Total de mensagens:', analytics.messages.total);
console.log('Sessões conectadas:', analytics.sessions.connected);`,
      python: `import requests

response = requests.get(
    '${BASE}/api/v1/analytics',
    headers={'X-API-Key': '${KEY}'}
)
data = response.json()
print(f"Total mensagens: {data['messages']['total']}")
print(f"Sessões conectadas: {data['sessions']['connected']}")`,
      php: `<?php
$ch = curl_init('${BASE}/api/v1/analytics');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => ['X-API-Key: ${KEY}'],
]);
$data = json_decode(curl_exec($ch), true);
echo 'Total mensagens: ' . $data['messages']['total'] . PHP_EOL;
echo 'Sessões conectadas: ' . $data['sessions']['connected'];`,
      go: `req, _ := http.NewRequest("GET", "${BASE}/api/v1/analytics", nil)
req.Header.Set("X-API-Key", "${KEY}")

resp, _ := (&http.Client{}).Do(req)
defer resp.Body.Close()

var result map[string]any
json.NewDecoder(resp.Body).Decode(&result)
msgs := result["messages"].(map[string]any)
fmt.Println("Total mensagens:", msgs["total"])`,
    },
  },
];

const MESSAGES: Endpoint[] = [
  {
    method: "POST",
    path: "/messages/send",
    description: "Envia uma mensagem imediatamente. A sessão deve estar com status connected. Suporta texto, imagem, vídeo, áudio e documento.",
    body: `{
  "sessionId": "minha-sessao",      // obrigatório
  "to":        "5511999887766",     // obrigatório — número ou JID (@s.whatsapp.net)
  "text":      "Olá, tudo bem?",    // texto da mensagem (opcional se usar mídia)
  "mediaUrl":  "https://...",       // URL da mídia (opcional)
  "mediaType": "image",             // image | video | audio | document
  "caption":   "Legenda da imagem"  // opcional, para mídias
}`,
    response: `{
  "message": "Mensagem enviada"
}`,
    codes: {
      curl: `# Mensagem de texto
curl -X POST ${BASE}/api/v1/messages/send \\
  -H "X-API-Key: ${KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "sessionId": "minha-sessao",
    "to": "5511999887766",
    "text": "Olá, tudo bem?"
  }'

# Mensagem com imagem
curl -X POST ${BASE}/api/v1/messages/send \\
  -H "X-API-Key: ${KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "sessionId": "minha-sessao",
    "to": "5511999887766",
    "mediaUrl": "https://example.com/foto.jpg",
    "mediaType": "image",
    "caption": "Confira nossa promoção!"
  }'`,
      nodejs: `// Mensagem de texto
await fetch('${BASE}/api/v1/messages/send', {
  method: 'POST',
  headers: {
    'X-API-Key': '${KEY}',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    sessionId: 'minha-sessao',
    to: '5511999887766',
    text: 'Olá, tudo bem?',
  }),
});

// Mensagem com imagem
await fetch('${BASE}/api/v1/messages/send', {
  method: 'POST',
  headers: {
    'X-API-Key': '${KEY}',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    sessionId: 'minha-sessao',
    to: '5511999887766',
    mediaUrl: 'https://example.com/foto.jpg',
    mediaType: 'image',
    caption: 'Confira nossa promoção!',
  }),
});`,
      python: `import requests

# Mensagem de texto
requests.post(
    '${BASE}/api/v1/messages/send',
    headers={'X-API-Key': '${KEY}'},
    json={
        'sessionId': 'minha-sessao',
        'to': '5511999887766',
        'text': 'Olá, tudo bem?',
    }
)

# Mensagem com imagem
requests.post(
    '${BASE}/api/v1/messages/send',
    headers={'X-API-Key': '${KEY}'},
    json={
        'sessionId': 'minha-sessao',
        'to': '5511999887766',
        'mediaUrl': 'https://example.com/foto.jpg',
        'mediaType': 'image',
        'caption': 'Confira nossa promoção!',
    }
)`,
      php: `<?php
// Mensagem de texto
$ch = curl_init('${BASE}/api/v1/messages/send');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => [
        'X-API-Key: ${KEY}',
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'sessionId' => 'minha-sessao',
        'to'        => '5511999887766',
        'text'      => 'Olá, tudo bem?',
    ]),
]);
$data = json_decode(curl_exec($ch), true);
echo $data['message'];`,
      go: `package main

import (
    "bytes"
    "encoding/json"
    "net/http"
)

func sendMessage(sessionID, to, text string) error {
    payload, _ := json.Marshal(map[string]string{
        "sessionId": sessionID,
        "to":        to,
        "text":      text,
    })
    req, _ := http.NewRequest("POST", "${BASE}/api/v1/messages/send", bytes.NewBuffer(payload))
    req.Header.Set("X-API-Key", "${KEY}")
    req.Header.Set("Content-Type", "application/json")

    resp, err := (&http.Client{}).Do(req)
    if err != nil {
        return err
    }
    defer resp.Body.Close()
    return nil
}`,
    },
  },
  {
    method: "POST",
    path: "/messages/queue",
    description: "Enfileira uma mensagem no RabbitMQ para envio assíncrono. Retorna imediatamente com um correlationId para rastreamento.",
    body: `{
  "sessionId": "minha-sessao",
  "to":        "5511999887766",
  "text":      "Mensagem em fila"
}`,
    response: `{
  "message":       "Mensagem enfileirada",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000"
}`,
    codes: {
      curl: `curl -X POST ${BASE}/api/v1/messages/queue \\
  -H "X-API-Key: ${KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "sessionId": "minha-sessao",
    "to": "5511999887766",
    "text": "Mensagem em fila"
  }'`,
      nodejs: `const res = await fetch('${BASE}/api/v1/messages/queue', {
  method: 'POST',
  headers: {
    'X-API-Key': '${KEY}',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    sessionId: 'minha-sessao',
    to: '5511999887766',
    text: 'Mensagem em fila',
  }),
});
const { correlationId } = await res.json();
console.log('Rastrear com:', correlationId);`,
      python: `import requests

response = requests.post(
    '${BASE}/api/v1/messages/queue',
    headers={'X-API-Key': '${KEY}'},
    json={
        'sessionId': 'minha-sessao',
        'to': '5511999887766',
        'text': 'Mensagem em fila',
    }
)
data = response.json()
print('correlationId:', data['correlationId'])`,
      php: `<?php
$ch = curl_init('${BASE}/api/v1/messages/queue');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => [
        'X-API-Key: ${KEY}',
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'sessionId' => 'minha-sessao',
        'to'        => '5511999887766',
        'text'      => 'Mensagem em fila',
    ]),
]);
$data = json_decode(curl_exec($ch), true);
echo $data['correlationId'];`,
      go: `payload, _ := json.Marshal(map[string]string{
    "sessionId": "minha-sessao",
    "to":        "5511999887766",
    "text":      "Mensagem em fila",
})
req, _ := http.NewRequest("POST", "${BASE}/api/v1/messages/queue", bytes.NewBuffer(payload))
req.Header.Set("X-API-Key", "${KEY}")
req.Header.Set("Content-Type", "application/json")

resp, _ := (&http.Client{}).Do(req)
defer resp.Body.Close()

var result map[string]any
json.NewDecoder(resp.Body).Decode(&result)
fmt.Println("correlationId:", result["correlationId"])`,
    },
  },
];

// ─── Nav ─────────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: "overview", label: "Visão Geral", icon: BookOpen },
  { id: "auth", label: "Autenticação", icon: Key },
  { id: "sessions", label: "Sessões", icon: Smartphone },
  { id: "messages", label: "Mensagens", icon: MessageSquare },
  { id: "webhooks", label: "Webhooks", icon: Webhook },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "quickstart", label: "Quickstart", icon: Zap },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WikiPage() {
  const [activeSection, setActiveSection] = useState("overview");
  const contentRef = useRef<HTMLDivElement>(null);

  const scrollTo = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left nav */}
      <aside className="w-52 shrink-0 border-r border-border/30 flex flex-col py-6 px-3 gap-0.5 overflow-y-auto custom-scrollbar bg-background/30">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 px-3 mb-3">
          Documentação
        </p>
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => scrollTo(id)}
            className={cn(
              "group flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all text-left",
              activeSection === id
                ? "bg-secondary text-foreground font-semibold"
                : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
            )}
          >
            <Icon
              size={15}
              className={cn(
                "shrink-0",
                activeSection === id ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
              )}
            />
            <span className="truncate">{label}</span>
            {activeSection === id && (
              <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
            )}
          </button>
        ))}

        <div className="mt-auto pt-6 px-3 space-y-2">
          <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">Base URL</p>
          <code className="text-[10px] font-mono text-primary/80 break-all">http://localhost:4000</code>
        </div>
      </aside>

      {/* Content */}
      <div
        ref={contentRef}
        className="flex-1 overflow-y-auto p-8 space-y-14 custom-scrollbar"
        onScroll={(e) => {
          const container = e.currentTarget;
          for (const { id } of NAV_ITEMS) {
            const el = document.getElementById(id);
            if (el && el.offsetTop - container.scrollTop <= 80) {
              setActiveSection(id);
            }
          }
        }}
      >
        {/* ── Visão Geral ── */}
        <Section id="overview" icon={BookOpen} title="Visão Geral">
          <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
            A WhatsApp API permite gerenciar múltiplas sessões WhatsApp e enviar mensagens programaticamente. Baseada em{" "}
            <span className="text-primary font-semibold">Baileys</span>, utiliza Redis para cache de sessões, RabbitMQ
            para filas de mensagens e Convex como banco de dados.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "Porta padrão", value: "4000", color: "text-primary" },
              { label: "Prefixo", value: "/api/v1", color: "text-emerald-400" },
              { label: "Formato", value: "JSON", color: "text-sky-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="p-4 rounded-2xl bg-card/40 border border-border/40">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
                <code className={cn("text-base font-mono font-bold", color)}>{value}</code>
              </div>
            ))}
          </div>

          {/* Tabela de endpoints */}
          <div className="rounded-2xl border border-border/40 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-muted/20">
                  <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Método</th>
                  <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Endpoint</th>
                  <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Descrição</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { method: "POST", path: "/sessions", desc: "Criar sessão" },
                  { method: "GET", path: "/sessions", desc: "Listar sessões" },
                  { method: "GET", path: "/sessions/:id/status", desc: "Status da sessão" },
                  { method: "GET", path: "/sessions/:id/qr", desc: "QR code para vincular" },
                  { method: "POST", path: "/sessions/:id/restart", desc: "Reiniciar sessão" },
                  { method: "PUT", path: "/sessions/:id/webhook", desc: "Atualizar webhook da sessão" },
                  { method: "DELETE", path: "/sessions/:id", desc: "Remover sessão (logout)" },
                  { method: "POST", path: "/messages/send", desc: "Enviar mensagem imediata" },
                  { method: "POST", path: "/messages/queue", desc: "Enfileirar mensagem (async)" },
                  { method: "GET", path: "/webhooks", desc: "Listar webhooks globais" },
                  { method: "POST", path: "/webhooks", desc: "Criar webhook global" },
                  { method: "PUT", path: "/webhooks/:id", desc: "Atualizar webhook" },
                  { method: "DELETE", path: "/webhooks/:id", desc: "Remover webhook" },
                  { method: "GET", path: "/analytics", desc: "Métricas e estatísticas" },
                ].map(({ method, path, desc }, i) => (
                  <tr key={i} className="border-b border-border/20 last:border-0 hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3">
                      <MethodBadge method={method} />
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs font-mono text-foreground/80">/api/v1{path}</code>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ── Autenticação ── */}
        <Section id="auth" icon={Key} title="Autenticação">
          <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
            Todos os endpoints (exceto <code className="text-primary text-xs">/health</code>) exigem autenticação via header{" "}
            <code className="text-primary text-xs">X-API-Key</code>. Não há suporte a query param.
          </p>

          <div className="p-5 rounded-2xl bg-card/40 border border-border/40 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Header obrigatório</p>
            <pre className="text-xs font-mono text-primary/90 bg-primary/5 border border-primary/10 rounded-xl p-3">
              X-API-Key: sua_api_key
            </pre>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-2xl bg-yellow-500/5 border border-yellow-500/20">
            <Circle size={16} className="text-yellow-400 shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              A chave de API é definida pela variável <code className="text-primary text-xs">API_SECRET</code> no arquivo{" "}
              <code className="text-primary text-xs">.env</code> do backend. Nunca exponha a chave em código front-end público.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Exemplo de autenticação</p>
            <CodeBlock
              codes={{
                curl: `curl ${BASE}/api/v1/sessions \\
  -H "X-API-Key: ${KEY}"`,
                nodejs: `// Usando fetch nativo
const res = await fetch('${BASE}/api/v1/sessions', {
  headers: { 'X-API-Key': process.env.WHATSAPP_API_KEY },
});

// Com axios
import axios from 'axios';
const client = axios.create({
  baseURL: '${BASE}/api/v1',
  headers: { 'X-API-Key': process.env.WHATSAPP_API_KEY },
});
const { data } = await client.get('/sessions');`,
                python: `import requests
import os

session = requests.Session()
session.headers.update({'X-API-Key': os.environ['WHATSAPP_API_KEY']})

# Reutilize a session para todas as chamadas
response = session.get('${BASE}/api/v1/sessions')`,
                php: `<?php
define('API_KEY', getenv('WHATSAPP_API_KEY'));
define('BASE_URL', '${BASE}/api/v1');

function api_request(string $method, string $path, ?array $body = null): array {
    $ch = curl_init(BASE_URL . $path);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => [
            'X-API-Key: ' . API_KEY,
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS => $body ? json_encode($body) : null,
    ]);
    return json_decode(curl_exec($ch), true);
}`,
                go: `package whatsapp

import (
    "net/http"
    "os"
)

type Client struct {
    baseURL string
    apiKey  string
    http    *http.Client
}

func NewClient() *Client {
    return &Client{
        baseURL: "${BASE}/api/v1",
        apiKey:  os.Getenv("WHATSAPP_API_KEY"),
        http:    &http.Client{},
    }
}

func (c *Client) newRequest(method, path string, body io.Reader) (*http.Request, error) {
    req, err := http.NewRequest(method, c.baseURL+path, body)
    if err != nil {
        return nil, err
    }
    req.Header.Set("X-API-Key", c.apiKey)
    req.Header.Set("Content-Type", "application/json")
    return req, nil
}`,
              }}
            />
          </div>
        </Section>

        {/* ── Sessões ── */}
        <Section id="sessions" icon={Smartphone} title="Sessões">
          <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
            Uma sessão representa uma conexão WhatsApp. O ciclo de vida é:{" "}
            <span className="text-yellow-400 font-semibold">connecting</span> →{" "}
            <span className="text-yellow-400 font-semibold">qr_ready</span> →{" "}
            <span className="text-emerald-400 font-semibold">connected</span>. Use o QR code para vincular o
            número.
          </p>
          <div className="space-y-8">
            {SESSIONS.map((ep, i) => (
              <EndpointCard key={i} endpoint={ep} />
            ))}
          </div>
        </Section>

        {/* ── Mensagens ── */}
        <Section id="messages" icon={MessageSquare} title="Mensagens">
          <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
            Envie mensagens de texto ou mídia. Use <code className="text-primary text-xs">/send</code> para envio
            imediato (sessão deve estar conectada) ou <code className="text-primary text-xs">/queue</code> para
            envio assíncrono via RabbitMQ.
          </p>
          <div className="space-y-8">
            {MESSAGES.map((ep, i) => (
              <EndpointCard key={i} endpoint={ep} />
            ))}
          </div>
        </Section>

        {/* ── Webhooks ── */}
        <Section id="webhooks" icon={Webhook} title="Webhooks">
          <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
            Configure webhooks para receber notificações em tempo real sobre eventos das sessões.
            Há dois tipos: <span className="text-primary font-semibold">por sessão</span> (via PUT /sessions/:id/webhook)
            e <span className="text-primary font-semibold">globais</span> (via CRUD /webhooks).
          </p>

          <div className="p-4 rounded-2xl bg-card/40 border border-border/40 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Eventos disponíveis</p>
            <div className="flex flex-wrap gap-2">
              {[
                "QRCODE_UPDATED",
                "CONNECTION_UPDATE",
                "MESSAGES_UPSERT",
                "MESSAGES_UPDATE",
                "MESSAGES_DELETE",
                "MESSAGES_SET",
                "CONTACTS_UPSERT",
                "CONTACTS_UPDATE",
                "GROUPS_UPSERT",
                "GROUPS_UPDATE",
                "GROUP_PARTICIPANTS_UPDATE",
              ].map((ev) => (
                <code key={ev} className="text-[10px] font-mono px-2 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20">
                  {ev}
                </code>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Se o array <code className="text-primary text-xs">events</code> estiver vazio, o webhook recebe <strong>todos</strong> os eventos.
            </p>
          </div>

          <div className="space-y-8">
            {WEBHOOKS.map((ep, i) => (
              <EndpointCard key={i} endpoint={ep} />
            ))}
          </div>
        </Section>

        {/* ── Analytics ── */}
        <Section id="analytics" icon={BarChart3} title="Analytics">
          <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
            Endpoint consolidado que retorna métricas dos últimos 30 dias: volume de mensagens (por dia, tipo e sessão),
            status das sessões e contagem de webhooks.
          </p>
          <div className="space-y-8">
            {ANALYTICS.map((ep, i) => (
              <EndpointCard key={i} endpoint={ep} />
            ))}
          </div>
        </Section>

        {/* ── Quickstart ── */}
        <Section id="quickstart" icon={Zap} title="Quickstart Completo">
          <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
            Fluxo completo: criar sessão → aguardar QR → conectar → enviar mensagem.
          </p>

          <div className="space-y-3">
            {[
              "Criar a sessão",
              "Verificar quando o QR estiver pronto",
              "Exibir o QR e aguardar scan",
              "Confirmar conexão",
              "Enviar mensagem",
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary text-[10px] font-black shrink-0">
                  {i + 1}
                </div>
                <ChevronRight size={14} className="text-muted-foreground/30 shrink-0" />
                <span>{step}</span>
              </div>
            ))}
          </div>

          <CodeBlock
            codes={{
              curl: `#!/bin/bash
API_KEY="${KEY}"
BASE="${BASE}/api/v1"
SESSION="quickstart-$$"

echo "1. Criando sessão..."
curl -s -X POST "$BASE/sessions" \\
  -H "X-API-Key: $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d "{\"sessionId\": \"$SESSION\"}"

echo "\\n2. Aguardando QR..."
while true; do
  STATUS=$(curl -s "$BASE/sessions/$SESSION/status" \\
    -H "X-API-Key: $API_KEY" | jq -r '.status')
  echo "   Status: $STATUS"
  [ "$STATUS" = "qr_ready" ] && break
  sleep 2
done

echo "\\n3. Obtendo QR code..."
curl -s "$BASE/sessions/$SESSION/qr" \\
  -H "X-API-Key: $API_KEY" | jq -r '.qr' > qr.b64

echo "\\n4. Aguardando conexão (escaneie o QR)..."
while true; do
  STATUS=$(curl -s "$BASE/sessions/$SESSION/status" \\
    -H "X-API-Key: $API_KEY" | jq -r '.status')
  [ "$STATUS" = "connected" ] && break
  sleep 3
done

echo "\\n5. Enviando mensagem..."
curl -s -X POST "$BASE/messages/send" \\
  -H "X-API-Key: $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d "{
    \\"sessionId\\": \\"$SESSION\\",
    \\"to\\": \\"5511999887766\\",
    \\"text\\": \\"Conectado com sucesso! 🎉\\"
  }"`,
              nodejs: `import fetch from 'node-fetch'; // ou fetch nativo no Node 18+

const BASE    = '${BASE}/api/v1';
const API_KEY = '${KEY}';

async function api(method, path, body) {
  const res = await fetch(\`\${BASE}\${path}\`, {
    method,
    headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

async function waitForStatus(sessionId, target, interval = 2000) {
  while (true) {
    const { status } = await api('GET', \`/sessions/\${sessionId}/status\`);
    console.log('  Status:', status);
    if (status === target) return;
    await new Promise(r => setTimeout(r, interval));
  }
}

// ── Fluxo completo ──
const SESSION = 'quickstart-' + Date.now();

console.log('1. Criando sessão...');
await api('POST', '/sessions', { sessionId: SESSION });

console.log('2. Aguardando QR...');
await waitForStatus(SESSION, 'qr_ready');

console.log('3. Obtendo QR code...');
const { qr } = await api('GET', \`/sessions/\${SESSION}/qr\`);
console.log('   QR:', qr.slice(0, 50) + '...');
// Exibir qr em uma <img> ou terminal (lib qrcode-terminal)

console.log('4. Aguardando scan...');
await waitForStatus(SESSION, 'connected', 3000);

console.log('5. Enviando mensagem!');
await api('POST', '/messages/send', {
  sessionId: SESSION,
  to: '5511999887766',
  text: 'Conectado com sucesso! 🎉',
});
console.log('Pronto!');`,
              python: `import time
import requests

BASE    = '${BASE}/api/v1'
HEADERS = {'X-API-Key': '${KEY}'}
SESSION = 'quickstart-python'


def api(method, path, **kwargs):
    return requests.request(method, BASE + path, headers=HEADERS, **kwargs).json()


def wait_for_status(session_id, target, interval=2):
    while True:
        status = api('GET', f'/sessions/{session_id}/status')['status']
        print(f'  Status: {status}')
        if status == target:
            return
        time.sleep(interval)


# ── Fluxo completo ──
print('1. Criando sessão...')
api('POST', '/sessions', json={'sessionId': SESSION})

print('2. Aguardando QR...')
wait_for_status(SESSION, 'qr_ready')

print('3. Obtendo QR code...')
qr = api('GET', f'/sessions/{SESSION}/qr')['qr']
print(f'   QR: {qr[:50]}...')

print('4. Aguardando scan...')
wait_for_status(SESSION, 'connected', interval=3)

print('5. Enviando mensagem!')
api('POST', '/messages/send', json={
    'sessionId': SESSION,
    'to': '5511999887766',
    'text': 'Conectado com sucesso! 🎉',
})
print('Pronto!')`,
              php: `<?php
define('BASE',    '${BASE}/api/v1');
define('API_KEY', '${KEY}');
define('SESSION', 'quickstart-php');

function api(string $method, string $path, ?array $body = null): array {
    $ch = curl_init(BASE . $path);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => ['X-API-Key: ' . API_KEY, 'Content-Type: application/json'],
        CURLOPT_POSTFIELDS     => $body ? json_encode($body) : null,
    ]);
    return json_decode(curl_exec($ch), true);
}

function waitForStatus(string $sessionId, string $target, int $interval = 2): void {
    while (true) {
        $status = api('GET', "/sessions/$sessionId/status")['status'];
        echo "  Status: $status\\n";
        if ($status === $target) return;
        sleep($interval);
    }
}

echo "1. Criando sessão...\\n";
api('POST', '/sessions', ['sessionId' => SESSION]);

echo "2. Aguardando QR...\\n";
waitForStatus(SESSION, 'qr_ready');

echo "3. Obtendo QR code...\\n";
$qr = api('GET', '/sessions/' . SESSION . '/qr')['qr'];
echo '   QR: ' . substr($qr, 0, 50) . "...\\n";

echo "4. Aguardando scan...\\n";
waitForStatus(SESSION, 'connected', 3);

echo "5. Enviando mensagem!\\n";
api('POST', '/messages/send', [
    'sessionId' => SESSION,
    'to'        => '5511999887766',
    'text'      => 'Conectado com sucesso! 🎉',
]);
echo "Pronto!\\n";`,
              go: `package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
    "time"
)

const (
    base    = "${BASE}/api/v1"
    apiKey  = "${KEY}"
    session = "quickstart-go"
)

func api(method, path string, body any) map[string]any {
    var buf *bytes.Buffer
    if body != nil {
        b, _ := json.Marshal(body)
        buf = bytes.NewBuffer(b)
    } else {
        buf = bytes.NewBuffer(nil)
    }
    req, _ := http.NewRequest(method, base+path, buf)
    req.Header.Set("X-API-Key", apiKey)
    req.Header.Set("Content-Type", "application/json")
    resp, _ := (&http.Client{}).Do(req)
    defer resp.Body.Close()
    var result map[string]any
    json.NewDecoder(resp.Body).Decode(&result)
    return result
}

func waitForStatus(sessionID, target string, interval time.Duration) {
    for {
        status := api("GET", "/sessions/"+sessionID+"/status", nil)["status"]
        fmt.Println("  Status:", status)
        if status == target {
            return
        }
        time.Sleep(interval)
    }
}

func main() {
    fmt.Println("1. Criando sessão...")
    api("POST", "/sessions", map[string]string{"sessionId": session})

    fmt.Println("2. Aguardando QR...")
    waitForStatus(session, "qr_ready", 2*time.Second)

    fmt.Println("3. Obtendo QR code...")
    qr := api("GET", "/sessions/"+session+"/qr", nil)["qr"].(string)
    fmt.Println("   QR:", qr[:50]+"...")

    fmt.Println("4. Aguardando scan...")
    waitForStatus(session, "connected", 3*time.Second)

    fmt.Println("5. Enviando mensagem!")
    api("POST", "/messages/send", map[string]string{
        "sessionId": session,
        "to":        "5511999887766",
        "text":      "Conectado com sucesso! 🎉",
    })
    fmt.Println("Pronto!")
}`,
            }}
          />
        </Section>
      </div>
    </div>
  );
}
