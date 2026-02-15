# Store — How to Add & Manage Products

## Quick Reference

- **Product data:** `data/products.ts`
- **Product types:** `types.ts` (Product interface)
- **Store page:** `components/StorePage.tsx`
- **Product detail:** `components/ProductDetail.tsx`
- **Deploys automatically** on push to `main`

---

## Adding a New Product

### 1. Add the product to `data/products.ts`

Copy an existing product block and edit it:

```ts
{
  slug: 'my-new-workflow',              // URL-safe, lowercase, hyphens only
  name: 'My New Workflow',              // Display name
  headline: 'One sentence hook.',       // Short pitch shown on card
  description: 'Longer description...', // Full description on detail page
  price: 197,                           // USD, whole number
  category: 'workflow',                 // 'workflow' | 'template' | 'agent'
  icon: Zap,                            // Lucide icon import (see below)
  features: [                           // "What It Does" section
    'Feature one',
    'Feature two',
  ],
  includes: [                           // "What You Get" section
    'n8n workflow JSON (ready to import)',
    'Setup guide with screenshots',
  ],
  checkoutUrl: 'https://ivanmanfredi.lemonsqueezy.com/buy/xxxxx',
},
```

### 2. Import the icon

At the top of `data/products.ts`, add any new Lucide icon you need:

```ts
import { Workflow, Bot, FileSpreadsheet, Zap, Mail, Target } from 'lucide-react';
```

Browse all icons at: https://lucide.dev/icons

### 3. Create the product on LemonSqueezy

1. Go to https://app.lemonsqueezy.com → Products → New Product
2. Set name, price, description
3. Upload the deliverable files (workflow JSON, setup guide PDF, etc.)
4. Under "Share" or "Checkout", copy the **checkout URL**
5. Paste it as the `checkoutUrl` in `data/products.ts`

The checkout URL looks like: `https://ivanmanfredi.lemonsqueezy.com/buy/xxxxxxxx`

### 4. Deploy

```bash
git add data/products.ts
git commit -m "Add new product: My New Workflow"
git push origin main
```

GitHub Actions auto-deploys to ivanmanfredi.com within ~2 minutes.

---

## Categories

Current categories and their colors:

| Category   | Value      | Card color | Filter tab |
|------------|------------|------------|------------|
| Workflow   | `workflow`  | Green      | Workflows  |
| Template   | `template`  | Blue       | Templates  |
| Agent      | `agent`     | Pink       | Agents     |

To add a new category:
1. Add the value to `ProductCategory` type in `types.ts`
2. Add label to `categoryLabels` in `data/products.ts`
3. Add color to `categoryColors` in both `ProductCard.tsx` and `ProductDetail.tsx`

---

## LemonSqueezy Setup (One-Time)

1. Create account at https://lemonsqueezy.com
2. Set store name to "Iván Manfredi" or similar
3. Add your bank/payout info
4. Each product you create there gets a checkout URL → paste into `data/products.ts`

### LemonSqueezy API Key

Stored in Claude memory. Can be used to create products programmatically via their API if needed.

### Post-Purchase Webhook (Optional)

To trigger an n8n workflow after each sale:
1. In LemonSqueezy → Settings → Webhooks
2. Add your n8n webhook URL
3. Select events: `order_created`, `order_refunded`
4. This lets you log sales to ClickUp, send custom emails, etc.
