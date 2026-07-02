export type NavLink = { label: string; href: string };

export const navLinks: NavLink[] = [
  { label: "Features", href: "/#features" },
  { label: "Tools", href: "/tools" },
  { label: "Pricing", href: "/#pricing" },
  { label: "API", href: "/dashboard#api-keys" },
  { label: "Enterprise", href: "/#pricing" },
];

export const TRANSLATE_LANGUAGES = [
  "Spanish", "French", "German", "Italian", "Portuguese", "Dutch", "Polish",
  "Romanian", "Swedish", "Norwegian", "Danish", "Finnish", "Czech", "Slovak",
  "Hungarian", "Greek", "Turkish", "Russian", "Ukrainian", "Arabic", "Hebrew",
  "Hindi", "Bengali", "Urdu", "Chinese (Simplified)", "Chinese (Traditional)",
  "Japanese", "Korean", "Vietnamese", "Thai", "Indonesian", "Malay", "English",
];

export const CITATION_STYLES = ["APA", "MLA", "Chicago", "Harvard"];

export const TONE_OPTIONS = [
  "Formal", "Friendly", "Confident", "Persuasive", "Empathetic",
  "Enthusiastic", "Neutral", "Direct",
];

export type Feature = { title: string; desc: string; d: string };

export const features: Feature[] = [
  {
    title: "AI Humanizer",
    desc: "Rewrite AI text into natural, undetectable human writing that keeps your voice intact.",
    d: "M12 3l1.9 4.6L18.5 9l-4.6 1.4L12 15l-1.9-4.6L5.5 9l4.6-1.4z",
  },
  {
    title: "AI Detection Checker",
    desc: "Scan any text against leading AI detectors and see exactly what gets flagged.",
    d: "M12 3l7 3v5c0 4-3 6.6-7 8-4-1.4-7-4-7-8V6z M9 12l2 2 4-4",
  },
  {
    title: "Plagiarism Checker",
    desc: "Compare against billions of sources and get a precise originality score in seconds.",
    d: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M21 21l-4.3-4.3",
  },
  {
    title: "Smart Paraphraser",
    desc: "Reword sentences for clarity and flow without ever losing the original meaning.",
    d: "M4 9a8 8 0 0 1 14-4l2 2 M20 15a8 8 0 0 1-14 4l-2-2 M18 3v4h-4 M6 21v-4h4",
  },
  {
    title: "Grammar & Spell Checker",
    desc: "Catch grammar, spelling, and punctuation slips with confident one-click fixes.",
    d: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M8 12l2.5 2.5L16 9",
  },
  {
    title: "Readability Analyzer",
    desc: "Grade-level scoring and suggestions that make dense writing effortless to read.",
    d: "M4 6a2 2 0 0 1 2-2h6v16H6a2 2 0 0 0-2 2z M20 6a2 2 0 0 0-2-2h-6v16h6a2 2 0 0 1 2 2z",
  },
  {
    title: "Tone Changer",
    desc: "Shift between formal, friendly, or persuasive tones with a single click.",
    d: "M4 8h9 M17 8h3 M4 16h3 M11 16h9 M15 6v4 M9 14v4",
  },
  {
    title: "Summarizer",
    desc: "Turn long documents into crisp, accurate summaries you can trust in seconds.",
    d: "M4 6h16 M4 12h16 M4 18h9",
  },
  {
    title: "SEO Keyword Optimizer",
    desc: "Optimize content for search with keyword density and search-intent analysis.",
    d: "M3 17l6-6 4 4 8-8 M15 7h6v6",
  },
];

export const moreFeatures: string[] = [
  "Plagiarism Remover",
  "Citation Generator",
  "Translator (30+ languages)",
  "Keyword Density Checker",
  "Word & Character Counter",
  "Reading Time Estimator",
  "AI Writing Assistant",
  "Document History",
  "Favorites & Folders",
  "Cloud Storage",
  "Export to PDF · DOCX · TXT",
  "Team Collaboration",
  "API Access",
  "Browser Extension",
  "Chrome & Word Integration",
  "All 14 Rewrite Modes",
];

export const modeNames: string[] = [
  "Humanize",
  "Academic",
  "Professional",
  "Business",
  "SEO Optimized",
  "Blog",
  "Email",
  "Social Media",
  "Native English",
  "Simplify",
  "Formal",
  "Friendly",
  "Persuasive",
  "Creative",
];

export type Step = { num: string; title: string; desc: string };

export const steps: Step[] = [
  {
    num: "1",
    title: "Paste or upload",
    desc: "Drop in text, upload a document, or paste from anywhere. We support DOCX, PDF, and TXT.",
  },
  {
    num: "2",
    title: "Choose your goals",
    desc: "Pick the tools and rewrite modes that match your intent — humanize, optimize, or refine.",
  },
  {
    num: "3",
    title: "AI analyzes & improves",
    desc: "Our engine rewrites, scores, and checks your content live across every writing metric.",
  },
  {
    num: "4",
    title: "Export & share",
    desc: "Copy, download, or share the polished result — or save it straight to your dashboard.",
  },
];

export type MetricColorKey = "green" | "red" | "accent";

export type MetricDef = {
  label: string;
  before: number;
  after: number;
  colorKey: MetricColorKey;
};

export const metricDefs: MetricDef[] = [
  { label: "Human Score", before: 9, after: 98, colorKey: "green" },
  { label: "AI Detection", before: 96, after: 3, colorKey: "red" },
  { label: "Plagiarism", before: 24, after: 1, colorKey: "red" },
  { label: "Grammar", before: 71, after: 99, colorKey: "green" },
  { label: "Readability", before: 48, after: 92, colorKey: "accent" },
  { label: "SEO Score", before: 40, after: 88, colorKey: "accent" },
];

export const dashHighlights: string[] = [
  "Recent documents",
  "Saved projects",
  "Usage statistics",
  "AI credits",
];

export type DashDoc = {
  name: string;
  time: string;
  tag: string;
  tagColor: string;
  tagBg: string;
};

export const dashDocs: DashDoc[] = [
  {
    name: "Q3 Content Strategy.docx",
    time: "Humanized · 2 hours ago",
    tag: "99% human",
    tagColor: "#12A150",
    tagBg: "#EAF7EF",
  },
  {
    name: "Product Launch Blog",
    time: "Edited · yesterday",
    tag: "SEO 88",
    tagColor: "#2E6BFF",
    tagBg: "#EAF1FF",
  },
  {
    name: "Investor Update Draft",
    time: "Checked · 2 days ago",
    tag: "0% plagiarism",
    tagColor: "#37435A",
    tagBg: "#F1F3F8",
  },
];

export type Plan = {
  name: string;
  popular: boolean;
  tagline: string;
  priceMonthly: string;
  priceAnnual: string;
  periodMonthly: string;
  periodAnnual: string;
  features: string[];
  cta: string;
  ctaHref: string;
  dark: boolean;
};

export const plans: Plan[] = [
  {
    name: "Free",
    popular: false,
    tagline: "For getting started",
    priceMonthly: "$0",
    priceAnnual: "$0",
    periodMonthly: "/forever",
    periodAnnual: "/forever",
    features: [
      "2,000 words / month",
      "AI Humanizer",
      "Basic AI detection",
      "Grammar & spell checker",
      "3 rewrite modes",
    ],
    cta: "Get started",
    ctaHref: "/signup",
    dark: false,
  },
  {
    name: "Pro",
    popular: true,
    tagline: "For professionals & creators",
    priceMonthly: "$19",
    priceAnnual: "$15",
    periodMonthly: "/month",
    periodAnnual: "/mo billed yearly",
    features: [
      "100,000 words / month",
      "All AI writing tools",
      "Advanced AI detection",
      "Plagiarism checker + remover",
      "All 14 rewrite modes",
      "Document history & export",
      "Priority support",
    ],
    cta: "Start Pro trial",
    ctaHref: "/signup",
    dark: true,
  },
  {
    name: "Enterprise",
    popular: false,
    tagline: "For teams at scale",
    priceMonthly: "Custom",
    priceAnnual: "Custom",
    periodMonthly: "",
    periodAnnual: "",
    features: [
      "Unlimited words",
      "Full API access",
      "Team collaboration & seats",
      "SSO & advanced security",
      "Dedicated success manager",
      "Custom integrations & SLA",
    ],
    cta: "Contact sales",
    ctaHref: "mailto:sales@humanflow.app",
    dark: false,
  },
];

export type CompareRow = { label: string; free: string; pro: string; ent: string };

export const compareRows: CompareRow[] = [
  { label: "Words per month", free: "2,000", pro: "100,000", ent: "Unlimited" },
  { label: "AI Humanizer", free: "✓", pro: "✓", ent: "✓" },
  { label: "AI detection", free: "Basic", pro: "Advanced", ent: "Advanced" },
  { label: "Plagiarism checker", free: "—", pro: "✓", ent: "✓" },
  { label: "Rewrite modes", free: "3", pro: "14", ent: "14" },
  { label: "Team seats", free: "1", pro: "1", ent: "Unlimited" },
  { label: "API access", free: "—", pro: "—", ent: "✓" },
  { label: "Export formats", free: "TXT", pro: "PDF · DOCX · TXT", ent: "All formats" },
  { label: "Support", free: "Community", pro: "Priority", ent: "Dedicated" },
];

export const payMethods: string[] = ["Visa", "Mastercard", "Amex", "PayPal", "Apple Pay"];

export type Testimonial = {
  quote: string;
  name: string;
  role: string;
  initials: string;
  avatarBg: string;
};

export const testimonials: Testimonial[] = [
  {
    quote:
      "HumanFlow cut our editing time in half. The humanizer actually preserves our brand voice — that’s genuinely rare in this category.",
    name: "Elena Fowler",
    role: "Head of Content, Northwind",
    initials: "EF",
    avatarBg: "linear-gradient(140deg,#2E6BFF,#8B7CF6)",
  },
  {
    quote:
      "I run every draft through it before publishing. The detection and plagiarism scores give me total peace of mind with clients.",
    name: "Marcus Reed",
    role: "Freelance Writer",
    initials: "MR",
    avatarBg: "linear-gradient(140deg,#12A150,#2E6BFF)",
  },
  {
    quote:
      "We rolled it out to 40 writers through the API. Setup took an afternoon and adoption across the team was instant.",
    name: "Priya Nair",
    role: "VP Marketing, Lumen",
    initials: "PN",
    avatarBg: "linear-gradient(140deg,#8B7CF6,#E5484D)",
  },
];

export type Faq = { question: string; answer: string };

export const faqs: Faq[] = [
  {
    question: "Is the humanized content really undetectable?",
    answer:
      "HumanFlow rewrites text so it reads naturally and consistently scores as human across leading AI detectors. We continuously retrain against new detection models to keep results reliable.",
  },
  {
    question: "How accurate is the AI detection?",
    answer:
      "Our detector is benchmarked against the latest generation of language models and reports a confidence score with sentence-level highlighting, so you can see exactly what would be flagged.",
  },
  {
    question: "Do you store or train on my documents?",
    answer:
      "No. Your content is private by default — we never train models on your documents, and you can permanently delete any document from your dashboard at any time.",
  },
  {
    question: "Can I use HumanFlow with Google Docs or Word?",
    answer:
      "Yes. Our browser extension works inside Google Docs and most web editors, and the Microsoft Word add-in brings humanizing and checking directly into your documents.",
  },
  {
    question: "What languages are supported?",
    answer:
      "HumanFlow supports over 30 languages for humanizing, paraphrasing, grammar, and translation, with native-quality output in English, Spanish, French, German, and more.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Absolutely. Plans are month-to-month or annual with no lock-in — cancel from your dashboard in one click and keep access until the end of your billing period.",
  },
];

export const socials: { d: string }[] = [
  {
    d: "M22 5.8a8.3 8.3 0 0 1-2.4.7 4.2 4.2 0 0 0 1.8-2.3c-.8.5-1.7.8-2.6 1a4.1 4.1 0 0 0-7 3.8A11.7 11.7 0 0 1 3.2 4.7a4.1 4.1 0 0 0 1.3 5.5c-.7 0-1.3-.2-1.9-.5v.1a4.1 4.1 0 0 0 3.3 4 4.2 4.2 0 0 1-1.9.1 4.1 4.1 0 0 0 3.8 2.9A8.3 8.3 0 0 1 2 18.6a11.7 11.7 0 0 0 6.3 1.8c7.5 0 11.7-6.3 11.7-11.7v-.5c.8-.6 1.5-1.3 2-2.1z",
  },
  {
    d: "M4.98 3.5A2.5 2.5 0 1 1 5 8.5a2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM10 9h3.8v1.7h.05c.53-1 1.83-2 3.75-2 4 0 4.75 2.6 4.75 6V21h-4v-5.3c0-1.3 0-2.9-1.8-2.9s-2 1.4-2 2.8V21h-4z",
  },
  {
    d: "M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.3-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-5a4 4 0 0 1 1-2.7c-.1-.3-.4-1.3.1-2.6 0 0 .8-.3 2.7 1a9.3 9.3 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.3.2 2.3.1 2.6a4 4 0 0 1 1 2.7c0 3.9-2.3 4.7-4.6 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A10 10 0 0 0 12 2z",
  },
  {
    d: "M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zM8.3 18H5.7V9.6h2.6zM7 8.4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM18.3 18h-2.6v-4.1c0-1-.4-1.6-1.3-1.6-.7 0-1.1.5-1.3 1-.1.2-.1.5-.1.7V18H10.4V9.6H13v1.1c.3-.5 1-1.3 2.5-1.3 1.8 0 2.8 1.2 2.8 3.6z",
  },
];

export type FooterCol = { title: string; links: { label: string; href: string }[] };

export const footerCols: FooterCol[] = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "Tools", href: "/tools" },
      { label: "Pricing", href: "/#pricing" },
      { label: "API", href: "/dashboard#api-keys" },
      { label: "Enterprise", href: "/#pricing" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Blog", href: "#" },
      { label: "Documentation", href: "/dashboard#api-keys" },
      { label: "Help Center", href: "/#faq" },
      { label: "Changelog", href: "#" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Careers", href: "#" },
      { label: "Contact", href: "mailto:hello@humanflow.app" },
      { label: "Security", href: "#" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "#" },
      { label: "Terms of Service", href: "#" },
      { label: "Cookies", href: "#" },
      { label: "GDPR", href: "#" },
    ],
  },
];
