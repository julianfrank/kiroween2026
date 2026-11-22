# LinkedIn post: weekend experiment with Kiro

Positioning: a weekend experiment with Kiro. Do not mention the hackathon. Put the video link in the post, and the repo link either in the post or in the first comment (LinkedIn tends to show posts with outside links to fewer people, so many people put links in the first comment).

---

I spent this weekend running an experiment: could I build a complete, private money manager, without a single server, by letting Kiro drive?

The result is Scary Money Manager 👻

→ One HTML file. Open it from disk or the web.
→ You type "Paid 800 for groceries yesterday" or "I've taken a loan of ₹5000 from Tom".
→ Chrome's on-device AI (Gemini Nano) proposes a proper double-entry entry, the app checks every number, and nothing is saved until you confirm.
→ Every value is encrypted with your password (PBKDF2 + AES-256-GCM). No bank login, no cloud, nothing leaves your laptop.
→ The theme follows your net worth. In the black it's calm. In the red, the lights go out and a ghost hand-writes a (painfully accurate) joke about your finances.

What surprised me most was how I worked with Kiro:

1️⃣ It interviewed me first: 28 questions, one decision at a time, before a line of code. Those answers became the spec, a glossary and the design decisions.
2️⃣ Steering files held the rules it must never break ("never trust the model with amounts").
3️⃣ Hooks ran the tests on every save and blocked any edit that would log a secret.
4️⃣ Property-based tests checked that every entry always balances and every reversal always cancels.
5️⃣ The small on-device model was the biggest lesson. It once turned "30L" into ₹3 crore. So the model only names things, and the app reads amounts, dates and accounts from your own words. A test set of 36 sentences against the real model went from 86% to 97% to 100%.

The shift for me: less vibe coding, more reviewing decisions.

🎬 2-minute demo: https://youtu.be/ZyYEkYlSjp0
💻 Code (MIT): https://github.com/julianfrank/kiroween2026
🔗 Try it in desktop Chrome: https://julianfrank.github.io/kiroween2026/

Would you trust a local AI with your books if nothing ever left your device?

#Kiro #AI #OnDeviceAI #GeminiNano #WebDevelopment #PersonalFinance #Privacy #SpecDrivenDevelopment #BuildInPublic

---

## Notes before posting

- The repo name contains "kiroween2026". If you want no hint of the competition at all, put only the video and the live app in the post (the README links to the repo), or rename the repo. Renaming changes the GitHub Pages URL, so update the README and the Devpost form if you do.
- The video description on YouTube should not mention the hackathon either, if you want the post to stay neutral.
- "2-minute demo": change it to the video's real length.
- Tag @Kiro (kirodotdev) only if you want Kiro's team to see it.
- This is separate from the Devpost Social Blitz post, which must start with the hackathon hashtag.
