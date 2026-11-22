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

Gothrough the rules of the Kiroween content in https://kiroween.devpost.com/rules and then help me Make the right choices for submission in https://kiroween.devpost.com/ 