# MedFlow Transcribe AI — Customization Guide

## 1. Branding (Logo, Colors, Name)

### Change the theme colors
Edit `src/app/globals.css`:
```css
:root {
  --mf-primary: #0B5345;    /* Your primary color */
  --mf-secondary: #1ABC9C;  /* Your secondary color */
  --mf-dark: #17202A;       /* Your dark accent */
  --mf-bg: #E8F8F5;         /* Your background */
}
```

### Change the app name
Edit `src/lib/medflow/constants.ts`:
```ts
export const APP_NAME = "YourApp Name";
export const APP_TAGLINE = "Your tagline here";
```

### Change the logo
Replace `public/medflow-logo.png` + `public/hero.png` with your own.

### Change the footer text
Edit `src/components/medflow/AppShell.tsx` — search for the `<footer>` section.

---

## 2. Adding a New Sidebar Section

### Step 1: Create the section component
```tsx
// src/components/medflow/sections/MySection.tsx
"use client";
import { PageHeader } from "./_shared";

export function MySection() {
  return (
    <div>
      <PageHeader title="My Section" description="My new section." icon={MyIcon} />
      {/* Your content */}
    </div>
  );
}
```

### Step 2: Add the nav item
Edit `src/lib/medflow/constants.ts`:
```ts
export const NAV_ITEMS: NavItem[] = [
  // ... existing items
  { id: "my-section", label: "My Section", icon: "MyIcon", group: "main" },
];
```

### Step 3: Add RBAC permission
Edit `src/lib/medflow/rbac.ts`:
```ts
export type Permission =
  // ... existing
  | "section.my-section";

export const SECTION_PERMISSIONS = {
  // ... existing
  "my-section": "section.my-section",
};

// Grant to roles:
"Tenant Owner": [ ..., "section.my-section" ],
```

### Step 4: Add the icon to AppShell
Edit `src/components/medflow/AppShell.tsx` — add your icon to the import + ICONS map.

### Step 5: Wire into page.tsx
Edit `src/app/page.tsx`:
```tsx
import { MySection } from "@/components/medflow/sections/MySection";
// In the switch:
case "my-section": return <MySection />;
```

---

## 3. Adding a New AI Agent (FastAPI)

### Step 1: Define the agent
Edit `mini-services/ai-agents-service/main.py`:
```python
AGENTS = [
    # ... existing agents
    {
        "id": "my-agent",
        "name": "My Custom Agent",
        "description": "Does something custom.",
        "category": "custom",
        "status": "idle",
        "model": "my-model-v1.0",
        "prompt_version": "v1.0.0",
        "supports_human_escalation": True,
        "input_schema": {"job_id": "string", "input": "any"},
    },
]
```

### Step 2: Add the run logic
In the `run_agent` function (or the `/api/agents/{agent_id}/run` handler):
```python
if agent_id == "my-agent":
    output = {
        "result": "Custom agent output",
        "processed": True,
    }
```

### Step 3: Add to the static fallback
Edit `src/lib/medflow/static-data.ts` — add the agent to `STATIC_AGENTS`.

---

## 4. Adding a New API Route

### Next.js API route
```ts
// src/app/api/medflow/my-endpoint/route.ts
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ message: "Hello" });
}

export async function POST(req: Request) {
  const body = await req.json();
  return NextResponse.json({ ok: true, ...body });
}
```

### FastAPI endpoint
```python
# mini-services/ai-agents-service/main.py
@app.post("/api/my-endpoint")
async def my_endpoint(data: dict):
    return {"status": "ok", "data": data}
```

The Next.js proxy (`/api/ai/my-endpoint`) will forward to FastAPI automatically.

---

## 5. Connecting Real AI Providers

### OpenAI (LLM + Whisper)
Set in `.env`:
```
OPENAI_API_KEY=sk-your-key-here
SPEECH_TO_TEXT_PROVIDER=openai
```

### z-ai-web-dev-sdk (already integrated)
The Voice Chatbot + Live Dictation already use `z-ai-web-dev-sdk`:
- `zai.chat.completions.create()` for LLM
- `zai.audio.asr.create()` for speech-to-text
- `zai.audio.tts.create()` for text-to-speech
- `zai.images.generations.create()` for image generation

No API key needed — the SDK is pre-configured in the environment.

---

## 6. Connecting Stripe (Real Billing)

1. Set in `.env`:
```
STRIPE_SECRET_KEY=sk_live_your_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_secret
```

2. Create products/prices in Stripe Dashboard for your 3 tiers.

3. Update `/api/medflow/stripe/route.ts` to call the real Stripe API:
```ts
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
// Replace mock data with real Stripe calls
```

---

## 7. Adding a New Kanban Column

Edit `src/lib/medflow/constants.ts`:
```ts
export const KANBAN_COLUMNS: KanbanColumn[] = [
  // ... existing columns
  { id: "my-column", label: "My Stage", statuses: ["My Status"], accent: "mf-tab-navy", icon: "MyIcon", help: "Description" },
];
```

Update `TranscriptionJob.status` in the Prisma schema to include your new status.

---

## 8. Customizing RBAC Permissions

### Add a new permission
Edit `src/lib/medflow/rbac.ts`:
```ts
export type Permission =
  | "section.my-section"
  | "action.my-action";

// Add to each role as needed:
"Tenant Owner": [ ..., "action.my-action" ],
```

### Use in a component
```tsx
import { useCan } from "@/hooks/medflow/useRbac";

function MyComponent() {
  const canDoThing = useCan("action.my-action");
  return canDoThing ? <Button>Do Thing</Button> : null;
}

// Or wrap with RoleGate:
<RoleGate permission="action.my-action">
  <Button>Do Thing</Button>
</RoleGate>
```
