# NOTES

Working notes for the transactions dashboard assessment - Claude added a lot more for summary details for this case I removed those and would add those type of details into a confluence file (or whatever system is used there) so that the details can be found and referenced without overwhelming the notes page in the repo

**Step 1: Task 2, fix the summary total** 
- something I noticed about the total processed amout that we are showing in the main dashboard, what is the defenition of processed? This is something that I would meet with product managers to determine what the actual definition of this term should be. For my changes I will call processed as approved transations and include the surcharge amount as well.
- there is also a rounding error on the cents shown where cents gets rounded incorrectly leading to a numerical error. IE amount shown could be 6,299,522.48 vs 6,299,522.49
  - make the sum in integer cents, not floats.
- add unit tests for checking to total amount shown in summary the summary.

**Step 2: Task 1, pagination + search** (biggest design piece)
- server-side search over merchant, id, card, status. The summary takes the same
      filter so the numbers match what's on screen.
- debounce the search, keep the page and search in the URL, added filters to some of the columns for user experience.
- Loading / empty / error states (fixes the endless spinner) and
- added ability for user to filter results by type as well with multi select
      remove the render `console.log`.

**Step 3: Task 3, Update the New Transaction form**
- added additions to the new transaction page
  - added fields that could be added so each part of the table is represented
  - added validation and warning for high percentage
  - added surcharge calculation so that the amount or the precent could be changed for ease of use
  - toast messaging for success or failure

**Step 4: Task 4, new detail page and remove old modal**
- removed the old modal since the task asks for a new page top be opened and this shows all the same info and more
- rows are now clickable and open new details page
- you can then from the details page filter on the entire table and copy paste the id value as well

**BONUS: Small correctness fixes found along the way**
- `formatDate` shows UTC dates a day early → format with `timeZone: "UTC"`.
- Handle the unknown `VOIDED` status (enum + default case in `statusTagColor`).
- noticed that some API keys were in the config file that is not hidden, so I moved those out - not sure if that was a gotcha for the test or not but figured why not hide them 
  - note that if this were real we would need to update the API keys ASAP since they were in a publicly viewed file as one point in the commit history


<!-- Removed lot of details that should be living in a working document like on Confluence or similar so that the knowledge can be transfered without overwhelming the notes here -->



## Short questions
1. **Data flow:**
In the original code each keystroke in the search updated a search state on the page, which re-rendered the whole page In this case all 10,000 transactions. According to Claude's test is showed 94,000 DOM elements, with no debounce. This was a bottleneck from rendering.

I moved search and pagination to the server, so the client renders 25 rows by default but this can be changes to be 50 or even 100. Each new debounced  request cancels the previous one so stale results can’t win .The trade-off is a short delay and a network request per search. I would call that a major win for the user!

2. **Client and server work:**
I put the data work on the server meaning  search, filters, sorting, pagination and the summary totals are done on the server side. Once the browser only has paginated rows (25 by default), it can’t search, sort, or total all the data correctly since it would only be using what is showing on the page. The list and the summary use the same filter on the server, so the numbers always match the table. 

The client handles the experience mainly the search box, the short delay before searching, cancelling old requests, keeping everything in the URL, and the loading, error and empty states.

In the situation with 10 million rows- I’d switch from page numbers to cursor-based pagination, because jumping to page 400,000 is slow and no one does it. Search would need a proper search index instead of checking every row. The summary totals would be the most expensive part, so I’d pre-compute them, use approximate counts, and leverage the cache more.

3. **Ship / no-ship:**
If this were a real repo and it were up to me I would first want to know for sure that all the API keys are infact in a safe place. This is why I moved them from the config.ts file. I would also want to determine that our true definition of processed total is correct. In my work I assumed it meant processed PLUS the surcharge amount.

If both of these points were confirmed beforehand (the API key placement and the working definition of processed is agreed upon) then I would approve this MR with my changes as GO

## With more time
With more time I would like to componentize different parts of the app so that things that could be resused be their own components. This is important when working in a large group so that work is not repeasted. I would add animation, better color themes, something to wow a user as they interact with the table (assuming this is for a customer and not some internal tool). Not to mention the things listed in the section above titled Improvement opportunities

## what changed?
🔑 Hid the secret keys
The app had its secret passwords written right in the code where anyone could read them. We moved them to a hidden place. In real life, you’d also change the passwords, because people already saw the old ones.

🔌 Fixed the plug mix-up
The two halves of the app (the part you see and the part with the data) were trying to use the same “plug”, so the page just spun forever. Now each half has its own.

💰 Fixed the money total
The “Total processed” number was wrong in two ways:

It counted money that never actually came in (declined and refunded payments).
Sometimes it lost a penny, because computers are bad at adding decimals. Now it adds up whole pennies instead.

📄 Pages instead of one giant list
Before, the app showed all 10,000 payments at once, and typing in the search box froze for 2 seconds. Now it shows 25 at a time, the server does the searching, and typing feels instant, about 50 times faster.

🔍 Search waits for you to finish typing
It doesn’t search after every letter. It waits until you pause.

↕️ Click a column to sort
Click “Amount” to see the biggest payments first. Click again to flip the order.

☑️ Pick which cards and statuses to show
Tick boxes on “Card” and “Status”, like “only show VISA and AMEX”.

🧹 A “Clear filters” button
One click puts everything back to how it started.

🔗 The page remembers where you are
Your search, filters and page number live in the web address. Refresh, Back, or sending the link to a friend all show the same thing.

➕ A much better “New transaction” form

It tells you what’s wrong before you submit.
It doesn’t lose your cents anymore ($12.99 used to become $12).
You can set the surcharge as a percent or as dollars, and it shows you the total.
New payments start as “Pending”.
Clicking “Create” twice won’t charge someone twice.

📋 Each payment gets its own page
Click a row and you go to a page with all its details, instead of a pop-up box. It also handles “this payment doesn’t exist” and “something went wrong, try again”.

📅 Fixed dates showing a day early
June 29 was showing as June 28 for people in the US. Now it’s right.

✅ Lots of tests
We added about 140 automatic checks that make sure all of this keeps working.


## THE TASK 2 Bug - in one sentence 
The total amount showing was off by a cent because the math used float with the cut-off formatting dropping pennies as well as adding in payments that were never actually done processing.

## Task 5: Improvement opportunities
- If I had more time to add to this I would thinking about first dividing the experience into two parts: 
  First -  users who are customers (limited access and mostly viewing purposes)
  Second -  users who are admins (access to update or delete entire entries). If this were to be added we would need to add some sort of ledger system that creates a history of changes
  - keep things mostly the same as far as the view goes but depending on the access the user has it would change the options they have for interacting with the dashboard

- I would like to see bulk actions added to the table
  - make it possible for someone with right to update the table to be able to go in and perform actions on more than one entry at a time
  - things like copy, delete, or update a detail if needed

- If the user should be able to edit (if they are an admin) then it would be cool to be able to edit existing entries details
  - this would only be something for admins
  -  abilty to edit entried would likely be something an org would need in some edge cases

- it would be really insightfull to add some more the to banner info in the page
  - since the number of processed could differ from the amount total (processed + declinded + refunded) or something like a toggle with a show processed + pending...

