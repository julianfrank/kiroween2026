# Scary Money Manager

## Idea
I want to Build a Simple Money Manager that can be distributted as a single HTML File that uses the browser's native AI Capability.
### Chrome Browser NAtive AI
When the user opens the file the app checks if the local AI is loaded and in working condition. If not it will initiate the Download and only proceed further after it is loaded and responding to prompts. Checkout the code related to this in https://developer.chrome.com/docs/ai/prompt-api. The user should be shown updates on the screen on each step of this process  like "Lownloading Model" with % tracking, "Initializing Model", "Testing Model" -> finally ending in "Ready to Work" Stage.

### Security
Now the user should enter a PAssword to be used in this session. This password would be used to encrypt all the data items in both the local browser storage or the exported/imported JSON files. The Rule is that Key remains unencypted while the value is encrypted. This way if another user opens the browser and enters the wrong password they cannot see any value stored int he Ledger. Or Budget/Goals databases. A default value shuld be used to test if the password is correct with default value of "Kiroween2026". This would let the application know if the password is correct without storing the password explicitely.

### Data Storage
Now the application shuld check the browser storage to check if there is a database already . If not then the USer should be made to create accounts with starting balances for both Assets and Liabilities. A Rules Engine should keep checking the entries and allow access to the main application only after the Accounts are Balanced. The Imbalance should be shown on screen clearly during this initial Entry Phase. 

### Data Import/Export
The user should be able to export the Data as a single JSON File with all "Value" Fields encrypted by the password given by the user. Similarly password should be used to import Data Files into a new session as well. Ensure that the model memory is also cleared so that it does not inadvertently divulge information about previos user or perform computations with previous user's details

### Main Application
In the main application user should be shown a simple UI to manage their Dashboard(Home),Assets, Liabilities, Goals, Budgets and Daily Updates (Ledger Entries)

All of these should be separate tabs with chat based ui where the user should be able to enter the detials in plain text to update the respective entries

For example in the Liability tab the user should be able to say "I've taken a Loan of Rs.5000 from Tom" then the AI should make an entry accordingly in the Ledger and ensure the Accounts are balanced.

Similarly Tagging to Goals for Savings/Investment Accounts and Budget for Expenses should be managed in separate databases.

The Dashbaord should show as a Key highlight a Sankey Diagram Charting the On Date Income to Expense to Budgets & Goals in a single picture
Other Personal Finance Related Graphs should also be poulated in real time like Trends for Income vs Expense vs Budget, Income vs Investments/Savings vs Goals etc



----------------------------

Go through the rules of the Kiroween content in https://kiroween.devpost.com/rules and then help me Make the right choices for submission in https://kiroween.devpost.com/ . I need you to give me clear instructions on What to Submit for each entry as follows: 
1) Elevator pitch
Provide a short tagline for the project. You can change this later.
2) Project Story
* About the project
Be sure to write what inspired you, what you learned, how you built your project, and the challenges you faced. Format your story in Markdown, with LaTeX support for math.
3) * Built with
You can add up to 25 tags.
4) Sponsor / Special Prizes
5)  Category
Select one — Appears in project gallery
6) 

These are the highlights, but review the full details carefully on the Rules tab!

Select your category and any Bonus Prizes you want to be considered for. See below for Bonus Prize individual requirements. 
URL to your public GitHub (NOT GitLab or BitBucket) for judging and testing
must contain all source code, assets, and instructions required for the project to be functional.
must be public and open source by including an open source license file. This license should be detectable and visible at the top of the repository page (in the About section). Here is how to add a license on GitHub.
must contain the /.kiro directory at the root of the project to show usage of specs, hooks, and steering. Do NOT add the /.kiro directory or sub-folders to your .gitignore, as this could disqualify your submission.
*For Skeleton Crew projects: Your repo must contain 2 separate repo folders for the 2 separate applications.
URL to your working app(s). If login credentials are needed to test the project, add any necessary login credentials and instructions within the Devpost Submission Form (which is not public and is shown to judges only).
Text description that explains the features and functionality of your project.
Demo video of your project.
Keep it under three (3) minutes. Judges are not required to watch beyond three minutes.
Show the project working on the device it was built for.
Upload it to YouTube and make it public.
Do not include third-party trademarks, copyrighted music, or other copyrighted material unless you have permission.
Provide a write-up on how Kiro was used. Judges must understand how effectively you used Kiro to develop your project. Show us your next-level understanding of Kiro features, e.g.:
Kiro IDE, CLI, Web, Crew? How did they differ, if you tried multiple?
Custom agents: Did you create or use any custom agents? Which Kiro app did you try them in? How did they impact your build?
Agent hooks: What specific workflows did you automate with Kiro hooks? How did these hooks improve your development process?
Spec-driven development: How did you structure your spec for Kiro to implement? How did the spec-driven approach improve your development process? How did this compare to vibe coding?
Steering docs: How did you leverage steering to improve Kiro’s responses? Was there a particular strategy that made the biggest difference?
MCP: How did extending Kiro’s capabilities help you build your project? What sort of features or workflow improvements did MCP enable that otherwise would have been difficult or impossible?
Property-based testing (PBT): Did PBT help catch any issues you might have missed with unit tests? What kind of requirements did you enable PBT for?
Kiro powers: Which powers did you leverage for bundled best practices and expertise in Kiro? Did you use any third-party tooling or integrations you wouldn’t have otherwise?
Bonus Prizes

Best Startup Project: Confirm that you are a founder of the startup. Include your LinkedIn profile and startup website.
Best Student Project: All team members must be students at a recognized academic institution. For each member, provide a LinkedIn profile, student email, year and degree, and school name. We may ask for proof of enrollment.
Best Ghost of Kiroween Past: Confirm in your submission that you registered for Kiroween 2025. We will check this against Kiroween 2025 records. Your 2026 project must be new.
Best Kiro Crew App: Provide the public URL to the GitHub repo for your Kiro Crew app. Describe its features and functionality.
Social Blitz Prize: Post on any social platform during the Submission Period. Use the hashtag #KiroweenHackathon26 at the beginning of the post. Share your favorite thing about Kiro and how it changed the way you approach development. Add your post URL to your submission.
Bonus Blog Prize: Publish a public blog post about Kiro and your project on any third-party blog platform during the Submission Period and mention it is being written as part of the Kiroween 2026 hackathon. Add the post URL to your submission.
Best Demo: No extra steps. All eligible submissions are considered.
An eligible project can win one Overall Prize or one Category Prize, not both. It can also win any number of Bonus Prizes. Please check the Official Rules for full details and judging criteria.

Judging Criteria
Potential Impact
Does the project make a credible case for solving a real problem for a real audience? Does the solution address that problem based on what’s demonstrated? How useful, intuitive, and accessible is it? Would someone actually use this?
Technological Implementation
How thoroughly and skillfully does the project use Kiro? Was there a thoughtful strategy to AI development? Was a variety of Kiro tools used impactfully? Does the project show a deep understanding of Kiro features? Was there experimentation?
Design
Does the project deliver a complete, coherent product experience, not just a technical proof of concept? Is the design intuitive, polished, and intentional?
Innovation/Idea
How creative and novel is the concept, and does the project differ from existing concepts? Are any unusual technologies or public resources (like datasets) leveraged or combined in a unique way?
Presentation
Does the video clearly demonstrate the project working end-to-end? Does the pitch communicate what problem is solved, who it’s for, and why it matters? Is the overall presentation easy to follow? Is the presentation creative and memorable?