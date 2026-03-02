# n8n Workflow Node Audit

Generated: 2026-03-01T21:56:51.447Z

## [AC] (1) Instagram Following [PROD]
- File: -AC-1-Instagram-Following-PROD-.json
- Workflow ID: klEpcDpBNWMOliSX
- Active: true
- Node count: 68
- Edge count: 71

### Nodes
1. **Extract Link CSV**
   - type: `n8n-nodes-base.code`
   - disabled: false
   - summary: jsCode=// Extractor robusto que busca en múltiples campos function extractCsvUrl(data) { // Campos posibles donde puede estar el log const possibleFields = ['output', 'log', 'message', 'text', 'body', 'respo…
2. **Get Link CVS**
   - type: `n8n-nodes-base.phantombuster`
   - disabled: false
   - summary: resource/op=getOutput | credentials=phantombusterApi
3. **Get the file**
   - type: `n8n-nodes-base.httpRequest`
   - disabled: false
   - summary: url=={{ $json.csvUrl }} | options={"redirect":{"redirect":{}},"response":{"response":{"responseFormat":"file"}}}
4. **Extract from File**
   - type: `n8n-nodes-base.extractFromFile`
   - disabled: false
5. **Wait**
   - type: `n8n-nodes-base.wait`
   - disabled: false
6. **Profile Scraper**
   - type: `@apify/n8n-nodes-apify.apify`
   - disabled: false
   - summary: resource/op=Actor tasks | credentials=apifyApi
7. **Followers**
   - type: `n8n-nodes-base.filter`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":[{"id":"fe23bc6e-106f-471d-b5bb-d24d7b6adbda","leftValue":"={{ $json.followersCount }}","rightValue":"={{ $vars.Instagra…
8. **(Video) Average Views**
   - type: `n8n-nodes-base.code`
   - disabled: false
   - summary: jsCode=// ========== INITIAL DEBUGGING ========== console.log('=== ANALYSIS START ==='); console.log('Items received:', $input.all().length); const results = []; const profileStats = {}; // Stats por usuario…
9. **Average Views**
   - type: `n8n-nodes-base.filter`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":[{"id":"e1d27b29-cc7d-42c1-8d76-5e6c8e7eb043","leftValue":"={{ $json.videoPerformance.averageViews }}","rightValue":"={{…
10. **Status**
   - type: `n8n-nodes-base.switch`
   - disabled: false
   - summary: rules={"values":[{"conditions":{"options":{"caseSensitive":false,"leftValue":"","typeValidation":"strict","version":2},"conditions":[{"leftValue":"={{ $json.status }}","rightValue":"fini… | options={"fallbackOutput":"extra","ignoreCase":true}
11. **Analyze Bio**
   - type: `@n8n/n8n-nodes-langchain.openAi`
   - disabled: false
   - summary: credentials=openAiApi
12. **Extracted Data**
   - type: `n8n-nodes-base.code`
   - disabled: false
   - summary: jsCode=// Obtener todos los datos del nodo 'Average Views' const averageViewsData = $('Average Views').all(); const profileScraperData = $('Profile Scraper').all(); const extractScraper = $("Get Data").all()…
13. **Save Data**
   - type: `n8n-nodes-base.airtable`
   - disabled: false
   - summary: resource/op=create | options={"typecast":true} | base={"__rl":true,"value":"appSt3GpYPstPjpl2","mode":"list","cachedResultName":"[People]- Instagram Followers","cachedResultU… | table={"__rl":true,"value":"tblR6Il1syV9muGlZ","mode":"list","cachedResultName":"Instagram Influencers","cachedResultUrl":"htt… | credentials=airtableTokenApi
14. **Followers ?**
   - type: `n8n-nodes-base.if`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":[{"id":"a8290d43-aecb-49be-9dfc-dc2e98c810ab","leftValue":"={{$input.item.json}}","rightValue":"","operator":{"type":"ob…
15. **Average Views ?**
   - type: `n8n-nodes-base.if`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":[{"id":"7174b0dd-3637-45e1-a051-45f8e5c18898","leftValue":"={{$input.item.json}}","rightValue":"","operator":{"type":"ob…
16. **Notify Completed Data**
   - type: `n8n-nodes-base.slack`
   - disabled: false
   - summary: text=={{ $json.content }} | credentials=slackOAuth2Api
17. **Notify Completed Data1**
   - type: `n8n-nodes-base.discord`
   - disabled: false
   - summary: credentials=discordWebhookApi
18. **Join Up**
   - type: `n8n-nodes-base.code`
   - disabled: false
   - summary: jsCode=const usernames = []; //const sources = new Set(); for (const item of $input.all()) { usernames.push(item.json.Username); // sources.add(item.json.fields.Sources); } const total = usernames.length; co…
19. **Personal Info ?**
   - type: `n8n-nodes-base.if`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":[{"id":"a28e4f94-3fb7-47a3-b37e-9f5f53034358","leftValue":"={{ $json.personalInfo }}","rightValue":"","operator":{"type"…
20. **Category Bio**
   - type: `n8n-nodes-base.filter`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":[{"id":"26aef2df-e84a-4f94-a1d9-a5bf44f6a31e","leftValue":"={{ $json.category }}","rightValue":"N/A","operator":{"type":…
21. **Parse Category **
   - type: `n8n-nodes-base.code`
   - disabled: false
   - summary: jsCode=const items = $input.all().map(item => { try { let content = item.json.message.content; // Remover bloques de código markdown si existen if (content.includes('```')) { content = content .replace(/```j…
22. **Category Bio ?**
   - type: `n8n-nodes-base.if`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":[{"id":"7174b0dd-3637-45e1-a051-45f8e5c18898","leftValue":"={{$input.item.json}}","rightValue":"","operator":{"type":"ob…
23. **Instagram Following**
   - type: `n8n-nodes-base.phantombuster`
   - disabled: false
   - summary: credentials=phantombusterApi
24. **Search records**
   - type: `n8n-nodes-base.airtable`
   - disabled: false
   - summary: resource/op=search | base={"__rl":true,"value":"appSt3GpYPstPjpl2","mode":"list","cachedResultName":"[People]- Instagram Followers","cachedResultU… | table={"__rl":true,"value":"tblR6Il1syV9muGlZ","mode":"list","cachedResultName":"Instagram Influencers","cachedResultUrl":"htt… | formula=={Username} = "{{ $json.personalInfo.username }}" | credentials=airtableTokenApi
25. **Loop Over Items**
   - type: `n8n-nodes-base.splitInBatches`
   - disabled: false
26. **Replace Me**
   - type: `n8n-nodes-base.noOp`
   - disabled: false
27. **Save Username**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: resource/op=append | options={"useAppend":true} | documentId={"__rl":true,"value":"https://docs.google.com/spreadsheets/d/1yjoiKi91cfNAT-1FujXCPiI3GBKJhoNn3LmPMMbXNmk/edit?gid=23919… | sheet={"__rl":true,"value":239191933,"mode":"list","cachedResultName":"Scraping [Temp]","cachedResultUrl":"https://docs.google… | credentials=googleSheetsOAuth2Api
28. **Aggregate**
   - type: `n8n-nodes-base.aggregate`
   - disabled: false
29. **Delete Temp Scraping**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: resource/op=delete | documentId={"__rl":true,"value":"https://docs.google.com/spreadsheets/d/1yjoiKi91cfNAT-1FujXCPiI3GBKJhoNn3LmPMMbXNmk/edit?gid=23919… | sheet={"__rl":true,"value":239191933,"mode":"list","cachedResultName":"Scraping [Temp]","cachedResultUrl":"https://docs.google… | credentials=googleSheetsOAuth2Api
30. **Get Data **
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: options={"dataLocationOnSheet":{"values":{"rangeDefinition":"detectAutomatically"}}} | documentId={"__rl":true,"value":"https://docs.google.com/spreadsheets/d/1yjoiKi91cfNAT-1FujXCPiI3GBKJhoNn3LmPMMbXNmk/edit?gid=23919… | sheet={"__rl":true,"value":239191933,"mode":"list","cachedResultName":"Scraping [Temp]","cachedResultUrl":"https://docs.google… | credentials=googleSheetsOAuth2Api
31. **user?**
   - type: `n8n-nodes-base.if`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":[{"id":"46200b05-d9d0-450c-8577-bb8ada7ba104","leftValue":"={{ $json.username }}","rightValue":"","operator":{"type":"st…
32. **url ??**
   - type: `n8n-nodes-base.if`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":[{"id":"ab939d8d-7667-49ce-8d4f-95638fb32a91","leftValue":"={{ $json.csvUrl }}","rightValue":"null","operator":{"type":"…
33. **Not Url**
   - type: `n8n-nodes-base.stopAndError`
   - disabled: false
34. **Check the status phathom**
   - type: `n8n-nodes-base.stopAndError`
   - disabled: false
35. **Get row(s) in sheet**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: options={"dataLocationOnSheet":{"values":{"rangeDefinition":"detectAutomatically"}}} | documentId={"__rl":true,"value":"https://docs.google.com/spreadsheets/d/1yjoiKi91cfNAT-1FujXCPiI3GBKJhoNn3LmPMMbXNmk/edit?gid=23919… | sheet={"__rl":true,"value":239191933,"mode":"list","cachedResultName":"Scraping [Temp]","cachedResultUrl":"https://docs.google… | credentials=googleSheetsOAuth2Api
36. **Aggregate1**
   - type: `n8n-nodes-base.aggregate`
   - disabled: false
37. **Extract Email**
   - type: `n8n-nodes-base.code`
   - disabled: false
   - summary: jsCode=// Función para extraer email de un texto function extractEmail(text) { if (!text) return ""; // Regex robusto para detectar emails en cualquier parte del texto const emailRegex = /([a-zA-Z0-9._+-]+@[…
38. **Exist ?1**
   - type: `n8n-nodes-base.if`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":[{"id":"892f74fa-8bff-491a-9ea1-3909681319b8","leftValue":"={{ $json.Username }}","rightValue":"","operator":{"type":"st…
39. **Schedule Trigger**
   - type: `n8n-nodes-base.scheduleTrigger`
   - disabled: false
40. **PROD?**
   - type: `n8n-nodes-base.if`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":[{"id":"b089ee75-06af-4055-a4c7-1e3d66a08aa4","leftValue":"={{ $json.execution.mode }}","rightValue":"manual","operator"…
41. **Discord**
   - type: `n8n-nodes-base.discord`
   - disabled: false
   - summary: credentials=discordWebhookApi
42. **Error Trigger**
   - type: `n8n-nodes-base.errorTrigger`
   - disabled: false
43. **Sticky Note1**
   - type: `n8n-nodes-base.stickyNote`
   - disabled: false
44. **Sticky Note2**
   - type: `n8n-nodes-base.stickyNote`
   - disabled: false
45. **Save Data1**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: resource/op=appendOrUpdate | documentId={"__rl":true,"value":"https://docs.google.com/spreadsheets/d/1yjoiKi91cfNAT-1FujXCPiI3GBKJhoNn3LmPMMbXNmk/edit?gid=23919… | sheet={"__rl":true,"value":177861758,"mode":"list","cachedResultName":"Scraping","cachedResultUrl":"https://docs.google.com/sp… | credentials=googleSheetsOAuth2Api
46. **Aggregate2**
   - type: `n8n-nodes-base.aggregate`
   - disabled: false
47. **Get Data**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: documentId={"__rl":true,"value":"https://docs.google.com/spreadsheets/d/1yjoiKi91cfNAT-1FujXCPiI3GBKJhoNn3LmPMMbXNmk/edit?gid=23919… | sheet={"__rl":true,"value":177861758,"mode":"list","cachedResultName":"Scraping","cachedResultUrl":"https://docs.google.com/sp… | credentials=googleSheetsOAuth2Api
48. **Sticky Note3**
   - type: `n8n-nodes-base.stickyNote`
   - disabled: false
49. **Update True**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: resource/op=update | documentId={"__rl":true,"value":"https://docs.google.com/spreadsheets/d/1yjoiKi91cfNAT-1FujXCPiI3GBKJhoNn3LmPMMbXNmk/edit?pli=1&gid… | sheet={"__rl":true,"value":361742329,"mode":"list","cachedResultName":"Controller","cachedResultUrl":"https://docs.google.com/… | credentials=googleSheetsOAuth2Api
50. **Active Workflow ?**
   - type: `n8n-nodes-base.if`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":[{"id":"0978d3fb-11a0-4743-8d76-a09c041bdf03","leftValue":"={{ $json.Locked }}","rightValue":0,"operator":{"type":"numbe…
51. **Read Active Workflow**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: documentId={"__rl":true,"value":"https://docs.google.com/spreadsheets/d/1yjoiKi91cfNAT-1FujXCPiI3GBKJhoNn3LmPMMbXNmk/edit?gid=23919… | sheet={"__rl":true,"value":361742329,"mode":"list","cachedResultName":"Controller","cachedResultUrl":"https://docs.google.com/… | credentials=googleSheetsOAuth2Api
52. **Update False**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: resource/op=update | documentId={"__rl":true,"value":"https://docs.google.com/spreadsheets/d/1yjoiKi91cfNAT-1FujXCPiI3GBKJhoNn3LmPMMbXNmk/edit?pli=1&gid… | sheet={"__rl":true,"value":361742329,"mode":"list","cachedResultName":"Controller","cachedResultUrl":"https://docs.google.com/… | credentials=googleSheetsOAuth2Api
53. **Update Error**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: resource/op=update | documentId={"__rl":true,"value":"https://docs.google.com/spreadsheets/d/1yjoiKi91cfNAT-1FujXCPiI3GBKJhoNn3LmPMMbXNmk/edit?pli=1&gid… | sheet={"__rl":true,"value":361742329,"mode":"list","cachedResultName":"Controller","cachedResultUrl":"https://docs.google.com/… | credentials=googleSheetsOAuth2Api
54. **Update Error1**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: resource/op=update | documentId={"__rl":true,"value":"https://docs.google.com/spreadsheets/d/1yjoiKi91cfNAT-1FujXCPiI3GBKJhoNn3LmPMMbXNmk/edit?pli=1&gid… | sheet={"__rl":true,"value":361742329,"mode":"list","cachedResultName":"Controller","cachedResultUrl":"https://docs.google.com/… | credentials=googleSheetsOAuth2Api
55. **Sticky Note4**
   - type: `n8n-nodes-base.stickyNote`
   - disabled: false
56. **Get Data1**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: documentId={"__rl":true,"value":"https://docs.google.com/spreadsheets/d/1yjoiKi91cfNAT-1FujXCPiI3GBKJhoNn3LmPMMbXNmk/edit?gid=23919… | sheet={"__rl":true,"value":177861758,"mode":"list","cachedResultName":"Scraping","cachedResultUrl":"https://docs.google.com/sp… | credentials=googleSheetsOAuth2Api
57. **FIles on Sheet ?**
   - type: `n8n-nodes-base.if`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":[{"id":"2a5e5c70-8bef-4810-8f25-ac3633486714","leftValue":"={{$input.item.json }}","rightValue":"","operator":{"type":"o…
58. **Wait1**
   - type: `n8n-nodes-base.wait`
   - disabled: false
59. **Notify Completed Data2**
   - type: `n8n-nodes-base.slack`
   - disabled: false
   - summary: text=={{ $json.content }} | credentials=slackOAuth2Api
60. **Notify Completed Data3**
   - type: `n8n-nodes-base.discord`
   - disabled: false
   - summary: credentials=discordWebhookApi
61. **Join Up1**
   - type: `n8n-nodes-base.code`
   - disabled: false
   - summary: jsCode=const usernames = []; //const sources = new Set(); for (const item of $input.all()) { usernames.push(item.json.Username); // sources.add(item.json.fields.Sources); } const total = usernames.length; co…
62. **Delete Temp Scraping1**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: resource/op=delete | documentId={"__rl":true,"value":"https://docs.google.com/spreadsheets/d/1yjoiKi91cfNAT-1FujXCPiI3GBKJhoNn3LmPMMbXNmk/edit?gid=23919… | sheet={"__rl":true,"value":239191933,"mode":"list","cachedResultName":"Scraping [Temp]","cachedResultUrl":"https://docs.google… | credentials=googleSheetsOAuth2Api
63. **Get Data 1**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: options={"dataLocationOnSheet":{"values":{"rangeDefinition":"detectAutomatically"}}} | documentId={"__rl":true,"value":"https://docs.google.com/spreadsheets/d/1yjoiKi91cfNAT-1FujXCPiI3GBKJhoNn3LmPMMbXNmk/edit?gid=23919… | sheet={"__rl":true,"value":239191933,"mode":"list","cachedResultName":"Scraping [Temp]","cachedResultUrl":"https://docs.google… | credentials=googleSheetsOAuth2Api
64. **Get row(s) in sheet1**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: options={"dataLocationOnSheet":{"values":{"rangeDefinition":"detectAutomatically"}}} | documentId={"__rl":true,"value":"https://docs.google.com/spreadsheets/d/1yjoiKi91cfNAT-1FujXCPiI3GBKJhoNn3LmPMMbXNmk/edit?gid=23919… | sheet={"__rl":true,"value":239191933,"mode":"list","cachedResultName":"Scraping [Temp]","cachedResultUrl":"https://docs.google… | credentials=googleSheetsOAuth2Api
65. **Aggregate3**
   - type: `n8n-nodes-base.aggregate`
   - disabled: false
66. **Update**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: resource/op=update | documentId={"__rl":true,"value":"https://docs.google.com/spreadsheets/d/1yjoiKi91cfNAT-1FujXCPiI3GBKJhoNn3LmPMMbXNmk/edit?gid=23919… | sheet={"__rl":true,"value":177861758,"mode":"list","cachedResultName":"Scraping","cachedResultUrl":"https://docs.google.com/sp… | credentials=googleSheetsOAuth2Api
67. **Filter - Today**
   - type: `n8n-nodes-base.filter`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":3},"conditions":[{"id":"a6788f3e-6892-4544-a3c9-8d18443e4a9f","leftValue":"={{ $json.timestamp.toDateTime().toFormat('yy/MM/dd') }}","ri…
68. **Wait2**
   - type: `n8n-nodes-base.wait`
   - disabled: false

### Connections
- Get Link CVS [branch 0] -> Status (type=main, input=0)
- Extract Link CSV [branch 0] -> url ?? (type=main, input=0)
- Get the file [branch 0] -> Extract from File (type=main, input=0)
- Extract from File [branch 0] -> Filter - Today (type=main, input=0)
- Wait [branch 0] -> Get Link CVS (type=main, input=0)
- Profile Scraper [branch 0] -> Followers (type=main, input=0)
- Followers [branch 0] -> Followers ? (type=main, input=0)
- (Video) Average Views [branch 0] -> Average Views (type=main, input=0)
- Status [branch 0] -> Extract Link CSV (type=main, input=0)
- Status [branch 1] -> Wait (type=main, input=0)
- Status [branch 2] -> Check the status phathom (type=main, input=0)
- Average Views [branch 0] -> Average Views ? (type=main, input=0)
- Analyze Bio [branch 0] -> Parse Category  (type=main, input=0)
- Extracted Data [branch 0] -> Personal Info ? (type=main, input=0)
- Followers ? [branch 0] -> (Video) Average Views (type=main, input=0)
- Followers ? [branch 1] -> Wait1 (type=main, input=0)
- Average Views ? [branch 0] -> Analyze Bio (type=main, input=0)
- Average Views ? [branch 1] -> Wait1 (type=main, input=0)
- Save Data [branch 0] -> Save Username (type=main, input=0)
- Notify Completed Data [branch 0] -> Notify Completed Data1 (type=main, input=0)
- Join Up [branch 0] -> Notify Completed Data (type=main, input=0)
- Personal Info ? [branch 0] -> Search records (type=main, input=0)
- Personal Info ? [branch 1] -> Wait1 (type=main, input=0)
- Category Bio [branch 0] -> Category Bio ? (type=main, input=0)
- Parse Category  [branch 0] -> Category Bio (type=main, input=0)
- Category Bio ? [branch 0] -> Extracted Data (type=main, input=0)
- Category Bio ? [branch 1] -> Wait1 (type=main, input=0)
- Instagram Following [branch 0] -> Get Link CVS (type=main, input=0)
- Search records [branch 0] -> Exist ?1 (type=main, input=0)
- Loop Over Items [branch 0] -> Aggregate (type=main, input=0)
- Loop Over Items [branch 1] -> Replace Me (type=main, input=0)
- Replace Me [branch 0] -> user? (type=main, input=0)
- Save Username [branch 0] -> Wait2 (type=main, input=0)
- Aggregate [branch 0] -> Get Data  (type=main, input=0)
- Notify Completed Data1 [branch 0] -> Get row(s) in sheet (type=main, input=0)
- Get Data  [branch 0] -> Join Up (type=main, input=0)
- user? [branch 0] -> Profile Scraper (type=main, input=0)
- user? [branch 1] -> Wait1 (type=main, input=0)
- url ?? [branch 0] -> Get the file (type=main, input=0)
- url ?? [branch 1] -> Not Url (type=main, input=0)
- Get row(s) in sheet [branch 0] -> Aggregate1 (type=main, input=0)
- Aggregate1 [branch 0] -> Delete Temp Scraping (type=main, input=0)
- Extract Email [branch 0] -> Save Data (type=main, input=0)
- Exist ?1 [branch 0] -> Extract Email (type=main, input=0)
- Exist ?1 [branch 1] -> Wait1 (type=main, input=0)
- PROD? [branch 0] -> Discord (type=main, input=0)
- PROD? [branch 1] -> Update Error1 (type=main, input=0)
- Error Trigger [branch 0] -> PROD? (type=main, input=0)
- Schedule Trigger [branch 0] -> Read Active Workflow (type=main, input=0)
- Save Data1 [branch 0] -> Aggregate2 (type=main, input=0)
- Aggregate2 [branch 0] -> Get Data (type=main, input=0)
- Get Data [branch 0] -> Loop Over Items (type=main, input=0)
- Active Workflow ? [branch 0] -> Update True (type=main, input=0)
- Read Active Workflow [branch 0] -> Active Workflow ? (type=main, input=0)
- Update True [branch 0] -> Get Data1 (type=main, input=0)
- Delete Temp Scraping [branch 0] -> Update False (type=main, input=0)
- Discord [branch 0] -> Update Error (type=main, input=0)
- Get Data1 [branch 0] -> FIles on Sheet ? (type=main, input=0)
- FIles on Sheet ? [branch 0] -> Aggregate2 (type=main, input=0)
- FIles on Sheet ? [branch 1] -> Instagram Following (type=main, input=0)
- Wait1 [branch 0] -> Update (type=main, input=0)
- Notify Completed Data2 [branch 0] -> Notify Completed Data3 (type=main, input=0)
- Notify Completed Data3 [branch 0] -> Get row(s) in sheet1 (type=main, input=0)
- Join Up1 [branch 0] -> Notify Completed Data2 (type=main, input=0)
- Get Data 1 [branch 0] -> Join Up1 (type=main, input=0)
- Get row(s) in sheet1 [branch 0] -> Aggregate3 (type=main, input=0)
- Aggregate3 [branch 0] -> Delete Temp Scraping1 (type=main, input=0)
- Update Error [branch 0] -> Get Data 1 (type=main, input=0)
- Update [branch 0] -> Loop Over Items (type=main, input=0)
- Filter - Today [branch 0] -> Save Data1 (type=main, input=0)
- Wait2 [branch 0] -> Wait1 (type=main, input=0)

## [AC] (2) Follow Up Seeding [PROD]
- File: -AC-2-Follow-Up-Seeding-PROD-.json
- Workflow ID: gt1mI7ckbbQuKuew
- Active: true
- Node count: 34
- Edge count: 37

### Nodes
1. **Get many messages**
   - type: `n8n-nodes-base.gmail`
   - disabled: false
   - summary: resource/op=getAll | filters={"q":"=from:{{ $json.Email }} subject: Kalm - Partnership!"} | gmailOp=getAll | credentials=gmailOAuth2
2. **Answer ?**
   - type: `n8n-nodes-base.if`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":[{"id":"a564a374-c452-4cf3-88da-6104916ee390","leftValue":"={{ $json.id }}","rightValue":"={{ undefined }}","operator":{…
3. **Count > 5**
   - type: `n8n-nodes-base.if`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":[{"id":"e1f787a6-d42b-4024-a49b-8395cb4924ba","leftValue":"={{$json[\"Follow-up Emails Count\"] ? $json[\"Follow-up Emai…
4. **Follow Up**
   - type: `n8n-nodes-base.switch`
   - disabled: false
   - summary: rules={"values":[{"conditions":{"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":[{"leftValue":"={{ $json.fields[\"Follow-up Emails Coun…
5. **Follow Up #1**
   - type: `n8n-nodes-base.gmail`
   - disabled: false
   - summary: options={"appendAttribution":false} | subject=Kalm - Partnership! | message== Hi {{ $('Search count').item.json["First Name"] }}, just circling back in case you missed this! We’d still love to gif… | credentials=gmailOAuth2
6. **Follow Up #2**
   - type: `n8n-nodes-base.gmail`
   - disabled: false
   - summary: options={"appendAttribution":false} | subject=Kalm - Partnership! | message=={{ $('Search count').item.json["First Name"] }}, hope you're having a lovely week! We’d be so happy to send you a free … | credentials=gmailOAuth2
7. **Follow Up #3**
   - type: `n8n-nodes-base.gmail`
   - disabled: false
   - summary: options={"appendAttribution":false} | subject=Kalm - Partnership! | message==Hey {{ $('Search count').item.json["First Name"] }}, just checking back in on this! If you’re still interested, we’d lo… | credentials=gmailOAuth2
8. **Follow Up #4**
   - type: `n8n-nodes-base.gmail`
   - disabled: false
   - summary: options={"appendAttribution":false} | subject=Kalm - Partnership! | message==Hi {{ $('Search count').item.json["First Name"] }}, stopping by with a gentle follow-up! If you’d still like to try our… | credentials=gmailOAuth2
9. **Follow Up #5**
   - type: `n8n-nodes-base.gmail`
   - disabled: false
   - summary: options={"appendAttribution":false} | subject=Kalm - Partnership! | message== Hi {{ $('Search count').item.json["First Name"] }}, sending a final nudge your way! If it’s not something you want rig… | credentials=gmailOAuth2
10. **Replace Me**
   - type: `n8n-nodes-base.noOp`
   - disabled: false
11. **Welcome**
   - type: `n8n-nodes-base.gmail`
   - disabled: false
   - summary: options={"appendAttribution":false} | subject=Kalm - Partnership! | message==Hi {{ $('Extract First Name').item.json.firstName }}! I’m Kamila and I’m reaching out from Kalm! We’ve been following y… | credentials=gmailOAuth2
12. **PROD?**
   - type: `n8n-nodes-base.if`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":[{"id":"b089ee75-06af-4055-a4c7-1e3d66a08aa4","leftValue":"={{ $json.execution.mode }}","rightValue":"manual","operator"…
13. **Discord**
   - type: `n8n-nodes-base.discord`
   - disabled: false
   - summary: credentials=discordWebhookApi
14. **Error Trigger**
   - type: `n8n-nodes-base.errorTrigger`
   - disabled: false
15. **Google Sheets Trigger**
   - type: `n8n-nodes-base.googleSheetsTrigger`
   - disabled: false
   - summary: pollTimes={"item":[{"mode":"everyHour"}]} | documentId={"__rl":true,"value":"https://docs.google.com/spreadsheets/d/1yjoiKi91cfNAT-1FujXCPiI3GBKJhoNn3LmPMMbXNmk/edit?gid=23919… | sheet={"__rl":true,"value":436993650,"mode":"list","cachedResultName":"GHL","cachedResultUrl":"https://docs.google.com/spreads… | credentials=googleSheetsTriggerOAuth2Api
16. **Extract First Name**
   - type: `n8n-nodes-base.code`
   - disabled: false
   - summary: jsCode=const results = []; for (const item of $input.all()) { const fullName = item.json.fields?.["Full Name"] || item.json.Name || ''; // Limpiar y extraer primer nombre let firstName = fullName // Reemplaz…
17. **Loop Over Items**
   - type: `n8n-nodes-base.splitInBatches`
   - disabled: false
18. **Schedule Trigger**
   - type: `n8n-nodes-base.scheduleTrigger`
   - disabled: false
19. **Search records**
   - type: `n8n-nodes-base.airtable`
   - disabled: false
   - summary: resource/op=search | base={"__rl":true,"value":"appSt3GpYPstPjpl2","mode":"list","cachedResultName":"[People]- Instagram Followers","cachedResultU… | table={"__rl":true,"value":"tblR6Il1syV9muGlZ","mode":"list","cachedResultName":"Instagram Influencers","cachedResultUrl":"htt… | formula==AND({Username} = "{{ $json.Username }}", {Follow-up Date} = '') | credentials=airtableTokenApi
20. **Sticky Note**
   - type: `n8n-nodes-base.stickyNote`
   - disabled: false
21. **Sticky Note1**
   - type: `n8n-nodes-base.stickyNote`
   - disabled: false
22. **Update Data**
   - type: `n8n-nodes-base.airtable`
   - disabled: false
   - summary: resource/op=update | options={"typecast":true} | base={"__rl":true,"value":"appSt3GpYPstPjpl2","mode":"list","cachedResultName":"[People]- Instagram Followers","cachedResultU… | table={"__rl":true,"value":"tblR6Il1syV9muGlZ","mode":"list","cachedResultName":"Instagram Influencers","cachedResultUrl":"htt… | credentials=airtableTokenApi
23. **Replace Me1**
   - type: `n8n-nodes-base.noOp`
   - disabled: false
24. **Search count**
   - type: `n8n-nodes-base.airtable`
   - disabled: false
   - summary: resource/op=search | base={"__rl":true,"value":"appSt3GpYPstPjpl2","mode":"list","cachedResultName":"[People]- Instagram Followers","cachedResultU… | table={"__rl":true,"value":"tblR6Il1syV9muGlZ","mode":"list","cachedResultName":"Instagram Influencers","cachedResultUrl":"htt… | formula=={Username} = "{{ $('Replace Me1').item.json.Username }}" | credentials=airtableTokenApi
25. **Search influencer**
   - type: `n8n-nodes-base.airtable`
   - disabled: false
   - summary: resource/op=search | base={"__rl":true,"value":"appSt3GpYPstPjpl2","mode":"list","cachedResultName":"[People]- Instagram Followers","cachedResultU… | table={"__rl":true,"value":"tblR6Il1syV9muGlZ","mode":"list","cachedResultName":"Instagram Influencers","cachedResultUrl":"htt… | formula==AND(NOT({Follow-up Date} = ''), {Follow-up Emails Count} != 5) | credentials=airtableTokenApi
26. **3 days & Email & 5 Follow**
   - type: `n8n-nodes-base.filter`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":[{"id":"c732aaac-d41e-4b44-a173-9d3c1c4dbb6a","leftValue":"={{ $json[\"Follow-up Date\"] }}","rightValue":"={{ $now.minu…
27. **Wait 1 min**
   - type: `n8n-nodes-base.wait`
   - disabled: false
28. **Sticky Note2**
   - type: `n8n-nodes-base.stickyNote`
   - disabled: false
29. **Update Date & Count Follow**
   - type: `n8n-nodes-base.airtable`
   - disabled: false
   - summary: resource/op=update | options={"typecast":true} | base={"__rl":true,"value":"appSt3GpYPstPjpl2","mode":"list","cachedResultName":"[People]- Instagram Followers","cachedResultU… | table={"__rl":true,"value":"tblR6Il1syV9muGlZ","mode":"list","cachedResultName":"Instagram Influencers","cachedResultUrl":"htt… | credentials=airtableTokenApi
30. **Aggregate**
   - type: `n8n-nodes-base.aggregate`
   - disabled: false
31. **Loop Over Items1**
   - type: `n8n-nodes-base.splitInBatches`
   - disabled: false
32. **Replace Me2**
   - type: `n8n-nodes-base.noOp`
   - disabled: false
33. **Wait 2 minutes**
   - type: `n8n-nodes-base.wait`
   - disabled: false
34. **Date & Email ?**
   - type: `n8n-nodes-base.if`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":[{"id":"a1aaffbc-44e2-4de5-ac5e-eb0a29e23a24","leftValue":"={{ $('Google Sheets Trigger').item.json.Email }}","rightValu…

### Connections
- Get many messages [branch 0] -> Answer ? (type=main, input=0)
- Answer ? [branch 0] -> Aggregate (type=main, input=0)
- Answer ? [branch 1] -> Search count (type=main, input=0)
- Count > 5 [branch 0] -> Update Date & Count Follow (type=main, input=0)
- Count > 5 [branch 1] -> Loop Over Items (type=main, input=0)
- Follow Up [branch 0] -> Follow Up #1 (type=main, input=0)
- Follow Up [branch 1] -> Follow Up #2 (type=main, input=0)
- Follow Up [branch 2] -> Follow Up #3 (type=main, input=0)
- Follow Up [branch 3] -> Follow Up #4 (type=main, input=0)
- Follow Up [branch 4] -> Follow Up #5 (type=main, input=0)
- Follow Up #1 [branch 0] -> Replace Me (type=main, input=0)
- Follow Up #2 [branch 0] -> Replace Me (type=main, input=0)
- Follow Up #3 [branch 0] -> Replace Me (type=main, input=0)
- Follow Up #4 [branch 0] -> Replace Me (type=main, input=0)
- Follow Up #5 [branch 0] -> Replace Me (type=main, input=0)
- Replace Me [branch 0] -> Wait 1 min (type=main, input=0)
- Welcome [branch 0] -> Update Data (type=main, input=0)
- PROD? [branch 0] -> Discord (type=main, input=0)
- Error Trigger [branch 0] -> PROD? (type=main, input=0)
- Google Sheets Trigger [branch 0] -> Loop Over Items1 (type=main, input=0)
- Extract First Name [branch 0] -> Search records (type=main, input=0)
- Loop Over Items [branch 1] -> Replace Me1 (type=main, input=0)
- Search records [branch 0] -> Date & Email ? (type=main, input=0)
- Schedule Trigger [branch 0] -> Search influencer (type=main, input=0)
- Update Data [branch 0] -> Wait 2 minutes (type=main, input=0)
- Replace Me1 [branch 0] -> Get many messages (type=main, input=0)
- Search count [branch 0] -> Count > 5 (type=main, input=0)
- Search influencer [branch 0] -> 3 days & Email & 5 Follow (type=main, input=0)
- 3 days & Email & 5 Follow [branch 0] -> Loop Over Items (type=main, input=0)
- Wait 1 min [branch 0] -> Loop Over Items (type=main, input=0)
- Update Date & Count Follow [branch 0] -> Follow Up (type=main, input=0)
- Aggregate [branch 0] -> Loop Over Items (type=main, input=0)
- Loop Over Items1 [branch 1] -> Replace Me2 (type=main, input=0)
- Replace Me2 [branch 0] -> Extract First Name (type=main, input=0)
- Wait 2 minutes [branch 0] -> Loop Over Items1 (type=main, input=0)
- Date & Email ? [branch 0] -> Welcome (type=main, input=0)
- Date & Email ? [branch 1] -> Loop Over Items1 (type=main, input=0)

## [AC] (3) (4) Answer Email & Get Address & Shopify [PROD]
- File: -AC-3-4-Answer-Email-Get-Address-Shopify-PROD-.json
- Workflow ID: xQu2HGg7lMhuqOsi
- Active: true
- Node count: 47
- Edge count: 43

### Nodes
1. **Address ?**
   - type: `n8n-nodes-base.if`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":[{"id":"2ea18a96-456d-4e26-8b03-79c805366818","leftValue":"={{ $json.has_address }}","rightValue":"","operator":{"type":…
2. **Extract Address**
   - type: `n8n-nodes-base.code`
   - disabled: false
   - summary: jsCode=// Versión defensiva con limpieza de markdown const response = $input.first().json; // Manejar si viene como array o como objeto directo const data = Array.isArray(response) ? response[0] : response; …
3. **Save Data**
   - type: `n8n-nodes-base.airtable`
   - disabled: false
   - summary: resource/op=update | options={"typecast":true} | base={"__rl":true,"value":"appSt3GpYPstPjpl2","mode":"list","cachedResultName":"[People]- Instagram Followers","cachedResultU… | table={"__rl":true,"value":"tblR6Il1syV9muGlZ","mode":"list","cachedResultName":"Instagram Influencers","cachedResultUrl":"htt… | credentials=airtableTokenApi
4. **PROD?**
   - type: `n8n-nodes-base.if`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":[{"id":"b089ee75-06af-4055-a4c7-1e3d66a08aa4","leftValue":"={{ $json.execution.mode }}","rightValue":"manual","operator"…
5. **Discord**
   - type: `n8n-nodes-base.discord`
   - disabled: false
   - summary: credentials=discordWebhookApi
6. **Error Trigger**
   - type: `n8n-nodes-base.errorTrigger`
   - disabled: false
7. **Reply to a message**
   - type: `n8n-nodes-base.gmail`
   - disabled: false
   - summary: resource/op=thread | gmailOp=reply | message=={{ $json.output[0].content[0].text }} | credentials=gmailOAuth2
8. **Reply to a message1**
   - type: `n8n-nodes-base.gmail`
   - disabled: false
   - summary: resource/op=thread | gmailOp=reply | message==Got it! Thank you so much! Looking forward to seeing you try our Mouth Tape! Have a great day! | credentials=gmailOAuth2
9. **Get a product**
   - type: `n8n-nodes-base.shopify`
   - disabled: false
   - summary: resource/op=product | shopifyResource=product | shopifyOp=get | credentials=shopifyAccessTokenApi
10. **Formatted Answer**
   - type: `n8n-nodes-base.code`
   - disabled: false
   - summary: jsCode=// Obtener el texto del webhook const fullText = $('Extract Message Client').first().json.clientReply; // Función para extraer el mensaje del usuario (antes de la cita del email) function extractUserM…
11. **Count > 5**
   - type: `n8n-nodes-base.if`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":[{"id":"e1f787a6-d42b-4024-a49b-8395cb4924ba","leftValue":"={{ $('Search records1').item.json[\"Response Count Address\"…
12. **Create an order**
   - type: `n8n-nodes-base.shopify`
   - disabled: false
   - summary: credentials=shopifyAccessTokenApi
13. **Gmail Trigger**
   - type: `n8n-nodes-base.gmailTrigger`
   - disabled: false
   - summary: pollTimes={"item":[{"mode":"everyMinute"}]} | filters={} | credentials=gmailOAuth2
14. **Get many messages1**
   - type: `n8n-nodes-base.gmail`
   - disabled: false
   - summary: resource/op=getAll | filters={"q":"=from:{{ $json.email }} subject: Kalm - Partnership!"} | gmailOp=getAll | credentials=gmailOAuth2
15. **get email**
   - type: `n8n-nodes-base.code`
   - disabled: false
   - summary: jsCode=// Obtener el campo From const fromField = $input.first().json.From; // Extraer solo el email usando regex const emailMatch = fromField.match(/<(.+?)>/); const email = emailMatch ? emailMatch[1] : fro…
16. **Answer ?1**
   - type: `n8n-nodes-base.if`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":[{"id":"a564a374-c452-4cf3-88da-6104916ee390","leftValue":"={{ $json.id }}","rightValue":"={{ undefined }}","operator":{…
17. **Search records1**
   - type: `n8n-nodes-base.airtable`
   - disabled: false
   - summary: resource/op=search | base={"__rl":true,"value":"appSt3GpYPstPjpl2","mode":"list","cachedResultName":"[People]- Instagram Followers","cachedResultU… | table={"__rl":true,"value":"tblR6Il1syV9muGlZ","mode":"list","cachedResultName":"Instagram Influencers","cachedResultUrl":"htt… | formula==AND({Email} = "{{ $('get email').item.json.email }}", {Orden Shopify ID} = "") | credentials=airtableTokenApi
18. **Update Count Follow**
   - type: `n8n-nodes-base.airtable`
   - disabled: false
   - summary: resource/op=update | options={"typecast":true} | base={"__rl":true,"value":"appSt3GpYPstPjpl2","mode":"list","cachedResultName":"[People]- Instagram Followers","cachedResultU… | table={"__rl":true,"value":"tblR6Il1syV9muGlZ","mode":"list","cachedResultName":"Instagram Influencers","cachedResultUrl":"htt… | credentials=airtableTokenApi
19. **Extract Address **
   - type: `@n8n/n8n-nodes-langchain.openAi`
   - disabled: false
   - summary: credentials=openAiApi
20. **Update Count**
   - type: `n8n-nodes-base.airtable`
   - disabled: false
   - summary: resource/op=update | options={"typecast":true} | base={"__rl":true,"value":"appSt3GpYPstPjpl2","mode":"list","cachedResultName":"[People]- Instagram Followers","cachedResultU… | table={"__rl":true,"value":"tblR6Il1syV9muGlZ","mode":"list","cachedResultName":"Instagram Influencers","cachedResultUrl":"htt… | credentials=airtableTokenApi
21. **Answer Email**
   - type: `@n8n/n8n-nodes-langchain.openAi`
   - disabled: false
   - summary: credentials=openAiApi
22. **Sticky Note**
   - type: `n8n-nodes-base.stickyNote`
   - disabled: false
23. **Sticky Note1**
   - type: `n8n-nodes-base.stickyNote`
   - disabled: false
24. **Update Shopify ID & Thread**
   - type: `n8n-nodes-base.airtable`
   - disabled: false
   - summary: resource/op=update | options={"typecast":true} | base={"__rl":true,"value":"appSt3GpYPstPjpl2","mode":"list","cachedResultName":"[People]- Instagram Followers","cachedResultU… | table={"__rl":true,"value":"tblR6Il1syV9muGlZ","mode":"list","cachedResultName":"Instagram Influencers","cachedResultUrl":"htt… | credentials=airtableTokenApi
25. **Extract Name (JS)**
   - type: `n8n-nodes-base.code`
   - disabled: false
   - summary: jsCode=// Procesar cada item const results = []; for (const item of $input.all()) { const fullName = $('Search records1').first().json["Full Name"] || item.json.full_name || item.json.fullName || item.json.n…
26. **Needs LLM?**
   - type: `n8n-nodes-base.if`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict"},"conditions":[{"id":"needs-llm-check","leftValue":"={{ $json.needs_llm }}","rightValue":true,"operator":{"type":"boolean","operation":"equals"}}]…
27. **OpenAI Extract Name**
   - type: `n8n-nodes-base.httpRequest`
   - disabled: false
   - summary: method=POST | url=https://api.openai.com/v1/chat/completions | credentials=openAiApi
28. **Parse OpenAI Response**
   - type: `n8n-nodes-base.code`
   - disabled: false
   - summary: jsCode=// Parsear respuesta de OpenAI y combinar con data original const results = []; for (const item of $input.all()) { const original = item.json; let parsed = { first_name: null, last_name: null }; try {…
29. **Merge Results**
   - type: `n8n-nodes-base.merge`
   - disabled: false
30. **Final Output**
   - type: `n8n-nodes-base.set`
   - disabled: false
31. **Sticky Note2**
   - type: `n8n-nodes-base.stickyNote`
   - disabled: false
32. **Save Data1**
   - type: `n8n-nodes-base.airtable`
   - disabled: false
   - summary: resource/op=update | options={"typecast":true} | base={"__rl":true,"value":"appSt3GpYPstPjpl2","mode":"list","cachedResultName":"[People]- Instagram Followers","cachedResultU… | table={"__rl":true,"value":"tblR6Il1syV9muGlZ","mode":"list","cachedResultName":"Instagram Influencers","cachedResultUrl":"htt… | credentials=airtableTokenApi
33. **Reply to a message2**
   - type: `n8n-nodes-base.gmail`
   - disabled: false
   - summary: resource/op=thread | gmailOp=reply | message==Got it! Thank you so much! Looking forward to seeing you try our Mouth Tape! Have a great day! | credentials=gmailOAuth2
34. **Get a product1**
   - type: `n8n-nodes-base.shopify`
   - disabled: false
   - summary: resource/op=product | shopifyResource=product | shopifyOp=get | credentials=shopifyAccessTokenApi
35. **Create an order1**
   - type: `n8n-nodes-base.shopify`
   - disabled: false
   - summary: credentials=shopifyAccessTokenApi
36. **Update Shopify ID & Thread1**
   - type: `n8n-nodes-base.airtable`
   - disabled: false
   - summary: resource/op=update | options={"typecast":true} | base={"__rl":true,"value":"appSt3GpYPstPjpl2","mode":"list","cachedResultName":"[People]- Instagram Followers","cachedResultU… | table={"__rl":true,"value":"tblR6Il1syV9muGlZ","mode":"list","cachedResultName":"Instagram Influencers","cachedResultUrl":"htt… | credentials=airtableTokenApi
37. **Extract Name (JS)1**
   - type: `n8n-nodes-base.code`
   - disabled: false
   - summary: jsCode=// Procesar cada item const results = []; for (const item of $input.all()) { const fullName = $('Set Test Data').first().json['Full Name'] || item.json.full_name || item.json.fullName || item.json.nam…
38. **Needs LLM?1**
   - type: `n8n-nodes-base.if`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":1},"conditions":[{"id":"needs-llm-check","leftValue":"={{ $json.needs_llm }}","rightValue":true,"operator":{"type":"boolean","operation"…
39. **OpenAI Extract Name1**
   - type: `n8n-nodes-base.httpRequest`
   - disabled: false
   - summary: method=POST | url=https://api.openai.com/v1/chat/completions | credentials=openAiApi
40. **Parse OpenAI Response1**
   - type: `n8n-nodes-base.code`
   - disabled: false
   - summary: jsCode=// Parsear respuesta de OpenAI y combinar con data original const results = []; for (const item of $input.all()) { const original = item.json; let parsed = { first_name: null, last_name: null }; try {…
41. **Merge Results1**
   - type: `n8n-nodes-base.merge`
   - disabled: false
42. **Final Output1**
   - type: `n8n-nodes-base.set`
   - disabled: false
43. **When clicking ‘Execute workflow’**
   - type: `n8n-nodes-base.manualTrigger`
   - disabled: false
44. **Set Test Data**
   - type: `n8n-nodes-base.set`
   - disabled: false
45. **Extract Address1**
   - type: `n8n-nodes-base.code`
   - disabled: false
   - summary: jsCode=// Leer la dirección del nodo Set Test Data const fullAddress = $('Set Test Data').first().json.business_address; if (!fullAddress) { return { has_address: false, reason: "No se encontró business_addr…
46. **Get Full Email**
   - type: `n8n-nodes-base.gmail`
   - disabled: false
   - summary: resource/op=get | gmailOp=get | credentials=gmailOAuth2
47. **Extract Message Client**
   - type: `n8n-nodes-base.code`
   - disabled: false
   - summary: jsCode=const results = []; for (const item of $input.all()) { const html = $('Get Full Email').first().json.html || ''; // Convertir HTML a texto con saltos de línea let text = html .replace(/<style[^>]*>.*?…

### Connections
- Address ? [branch 0] -> Save Data (type=main, input=0)
- Address ? [branch 1] -> Count > 5 (type=main, input=0)
- Extract Address [branch 0] -> Address ? (type=main, input=0)
- Save Data [branch 0] -> Reply to a message1 (type=main, input=0)
- PROD? [branch 0] -> Discord (type=main, input=0)
- Error Trigger [branch 0] -> PROD? (type=main, input=0)
- Get a product [branch 0] -> Create an order (type=main, input=0)
- Formatted Answer [branch 0] -> Answer Email (type=main, input=0)
- Reply to a message1 [branch 0] -> Extract Name (JS) (type=main, input=0)
- Count > 5 [branch 0] -> Update Count (type=main, input=0)
- Create an order [branch 0] -> Update Shopify ID & Thread (type=main, input=0)
- Gmail Trigger [branch 0] -> get email (type=main, input=0)
- Get many messages1 [branch 0] -> Answer ?1 (type=main, input=0)
- get email [branch 0] -> Get many messages1 (type=main, input=0)
- Answer ?1 [branch 0] -> Get Full Email (type=main, input=0)
- Search records1 [branch 0] -> Update Count Follow (type=main, input=0)
- Update Count Follow [branch 0] -> Extract Message Client (type=main, input=0)
- Extract Address  [branch 0] -> Extract Address (type=main, input=0)
- Update Count [branch 0] -> Formatted Answer (type=main, input=0)
- Answer Email [branch 0] -> Reply to a message (type=main, input=0)
- Extract Name (JS) [branch 0] -> Needs LLM? (type=main, input=0)
- Needs LLM? [branch 0] -> OpenAI Extract Name (type=main, input=0)
- Needs LLM? [branch 1] -> Merge Results (type=main, input=1)
- OpenAI Extract Name [branch 0] -> Parse OpenAI Response (type=main, input=0)
- Parse OpenAI Response [branch 0] -> Merge Results (type=main, input=0)
- Merge Results [branch 0] -> Final Output (type=main, input=0)
- Final Output [branch 0] -> Get a product (type=main, input=0)
- Save Data1 [branch 0] -> Reply to a message2 (type=main, input=0)
- Reply to a message2 [branch 0] -> Extract Name (JS)1 (type=main, input=0)
- Get a product1 [branch 0] -> Create an order1 (type=main, input=0)
- Create an order1 [branch 0] -> Update Shopify ID & Thread1 (type=main, input=0)
- Extract Name (JS)1 [branch 0] -> Needs LLM?1 (type=main, input=0)
- Needs LLM?1 [branch 0] -> OpenAI Extract Name1 (type=main, input=0)
- Needs LLM?1 [branch 1] -> Merge Results1 (type=main, input=1)
- OpenAI Extract Name1 [branch 0] -> Parse OpenAI Response1 (type=main, input=0)
- Parse OpenAI Response1 [branch 0] -> Merge Results1 (type=main, input=0)
- Merge Results1 [branch 0] -> Final Output1 (type=main, input=0)
- Final Output1 [branch 0] -> Extract Address1 (type=main, input=0)
- When clicking ‘Execute workflow’ [branch 0] -> Set Test Data (type=main, input=0)
- Set Test Data [branch 0] -> Save Data1 (type=main, input=0)
- Extract Address1 [branch 0] -> Get a product1 (type=main, input=0)
- Get Full Email [branch 0] -> Search records1 (type=main, input=0)
- Extract Message Client [branch 0] -> Extract Address  (type=main, input=0)

## [AC] (7) (8) (9) Mentions [TESTING]
- File: -AC-7-8-9-Mentions-TESTING-.json
- Workflow ID: cTgOL46Fwj1o0iHu
- Active: true
- Node count: 52
- Edge count: 37

### Nodes
1. **Schedule Trigger**
   - type: `n8n-nodes-base.scheduleTrigger`
   - disabled: false
2. **Sticky Note**
   - type: `n8n-nodes-base.stickyNote`
   - disabled: false
3. **Sticky Note1**
   - type: `n8n-nodes-base.stickyNote`
   - disabled: false
4. **Sticky Note3**
   - type: `n8n-nodes-base.stickyNote`
   - disabled: false
5. **Shopify Trigger**
   - type: `n8n-nodes-base.shopifyTrigger`
   - disabled: false
   - summary: credentials=shopifyAccessTokenApi
6. **Sticky Note4**
   - type: `n8n-nodes-base.stickyNote`
   - disabled: false
7. **Sticky Note5**
   - type: `n8n-nodes-base.stickyNote`
   - disabled: false
8. **PROD?**
   - type: `n8n-nodes-base.if`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":[{"id":"b089ee75-06af-4055-a4c7-1e3d66a08aa4","leftValue":"={{ $json.execution.mode }}","rightValue":"manual","operator"…
9. **Discord**
   - type: `n8n-nodes-base.discord`
   - disabled: false
   - summary: credentials=discordWebhookApi
10. **Error Trigger**
   - type: `n8n-nodes-base.errorTrigger`
   - disabled: false
11. **Create Email**
   - type: `@n8n/n8n-nodes-langchain.openAi`
   - disabled: false
   - summary: credentials=openAiApi
12. **Reply to a message**
   - type: `n8n-nodes-base.gmail`
   - disabled: false
   - summary: resource/op=thread | gmailOp=reply | message=={{ $json.output[0].content[0].text }} | credentials=gmailOAuth2
13. **Status Delivered **
   - type: `n8n-nodes-base.if`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":[{"id":"a6d35a45-2b99-4b25-8ac2-8e00f1dc8dac","leftValue":"={{ $json.shipment_status }}","rightValue":"delivered","opera…
14. **Sticky Note2**
   - type: `n8n-nodes-base.stickyNote`
   - disabled: false
15. **Schedule Trigger1**
   - type: `n8n-nodes-base.scheduleTrigger`
   - disabled: false
16. **2 days **
   - type: `n8n-nodes-base.filter`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":[{"id":"c732aaac-d41e-4b44-a173-9d3c1c4dbb6a","leftValue":"={{ $json['Reminder Date Mentions'] }}","rightValue":"={{ $no…
17. **Create Email1**
   - type: `@n8n/n8n-nodes-langchain.openAi`
   - disabled: false
   - summary: credentials=openAiApi
18. **Reply to a message1**
   - type: `n8n-nodes-base.gmail`
   - disabled: false
   - summary: resource/op=thread | gmailOp=reply | message=={{ $json.output[0].content[0].text }} | credentials=gmailOAuth2
19. **Sticky Note8**
   - type: `n8n-nodes-base.stickyNote`
   - disabled: false
20. **IF Verify Token**
   - type: `n8n-nodes-base.if`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":1},"conditions":[{"id":"ff311b69-564d-4f8d-bdb8-3286f5cdaa56","leftValue":"={{ $json.query[\"hub.verify_token\"] }}","rightValue":"test1…
21. **Extract Challenge**
   - type: `n8n-nodes-base.code`
   - disabled: false
   - summary: jsCode=return [{ json: { challenge: $input.first().json.query['hub.challenge'] } }];
22. **Respond Challenge**
   - type: `n8n-nodes-base.respondToWebhook`
   - disabled: false
23. **Respond Error**
   - type: `n8n-nodes-base.respondToWebhook`
   - disabled: false
   - summary: options={"responseCode":403}
24. **Webhook**
   - type: `n8n-nodes-base.webhook`
   - disabled: false
   - summary: path=events
25. **Map by Event Type**
   - type: `n8n-nodes-base.code`
   - disabled: false
   - summary: jsCode=// Mapear eventos de Instagram a formato Excel const body = $input.first().json.body; let mapped = { timestamp: new Date().toISOString(), event_type: '', user_id: '', username: '', text: '', comment_i…
26. **Respond 200 OK**
   - type: `n8n-nodes-base.respondToWebhook`
   - disabled: false
   - summary: options={"responseCode":200}
27. **Sticky Note12**
   - type: `n8n-nodes-base.stickyNote`
   - disabled: false
28. **Get All IG Tags**
   - type: `n8n-nodes-base.code`
   - disabled: false
   - summary: jsCode=const IG_USER_ID = "17841464586344140"; const ACCESS_TOKEN = "EAALtDCufaXkBQmx72pQyCOBZA4ZCMnZB4SGmZBut8lPlhT3Az9xyRxl0MbZAZC4fAIkeudMnlXbOzBNlG7uyMqfYuIQVvidXTZAqvmmqDuljGtWUynadlhkCA6w2qn9IKPTA6ABCN…
29. **Match & Count**
   - type: `n8n-nodes-base.code`
   - disabled: false
   - summary: jsCode=// Tags del nodo anterior const tagsData = $('Get All IG Tags').first().json.tags; // Usuarios del Google Sheets const sheetUsers = $('Search influencer').all(); const results = []; for (const row of …
30. **Webhook Events**
   - type: `n8n-nodes-base.webhook`
   - disabled: false
   - summary: path=events
31. **Test Event**
   - type: `n8n-nodes-base.set`
   - disabled: false
32. **Set params**
   - type: `n8n-nodes-base.set`
   - disabled: false
33. **If history**
   - type: `n8n-nodes-base.if`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":[{"id":"92c7a06f-d902-4966-9270-5e5966ede24b","leftValue":"={{ $json.event_type }}","rightValue":"=story_mention","opera…
34. **Get username**
   - type: `n8n-nodes-base.httpRequest`
   - disabled: false
   - summary: url==https://graph.facebook.com/v24.0/{{ $json.message_id }}?fields=from,message
35. **Search records**
   - type: `n8n-nodes-base.airtable`
   - disabled: false
   - summary: resource/op=search | base={"__rl":true,"value":"appSt3GpYPstPjpl2","mode":"list","cachedResultName":"[People]- Instagram Followers","cachedResultU… | table={"__rl":true,"value":"tblR6Il1syV9muGlZ","mode":"list","cachedResultName":"Instagram Influencers","cachedResultUrl":"htt… | formula=={Orden Shopify ID} = {{ $('Shopify Trigger').item.json.order_id }} | credentials=airtableTokenApi
36. **Search influencer**
   - type: `n8n-nodes-base.airtable`
   - disabled: false
   - summary: resource/op=search | base={"__rl":true,"value":"appSt3GpYPstPjpl2","mode":"list","cachedResultName":"[People]- Instagram Followers","cachedResultU… | table={"__rl":true,"value":"tblR6Il1syV9muGlZ","mode":"list","cachedResultName":"Instagram Influencers","cachedResultUrl":"htt… | formula==AND(NOT({Delivered Date} = ''), OR({Post} = 0, {Post} = '')) | credentials=airtableTokenApi
37. **Update Delivered Date**
   - type: `n8n-nodes-base.airtable`
   - disabled: false
   - summary: resource/op=update | options={"typecast":true} | base={"__rl":true,"value":"appSt3GpYPstPjpl2","mode":"list","cachedResultName":"[People]- Instagram Followers","cachedResultU… | table={"__rl":true,"value":"tblR6Il1syV9muGlZ","mode":"list","cachedResultName":"Instagram Influencers","cachedResultUrl":"htt… | credentials=airtableTokenApi
38. **Search influencer1**
   - type: `n8n-nodes-base.airtable`
   - disabled: false
   - summary: resource/op=search | base={"__rl":true,"value":"appSt3GpYPstPjpl2","mode":"list","cachedResultName":"[People]- Instagram Followers","cachedResultU… | table={"__rl":true,"value":"tblR6Il1syV9muGlZ","mode":"list","cachedResultName":"Instagram Influencers","cachedResultUrl":"htt… | formula=={Username} = "{{ $json.from.username }}" | credentials=airtableTokenApi
39. **Update History**
   - type: `n8n-nodes-base.airtable`
   - disabled: false
   - summary: resource/op=update | options={"typecast":true} | base={"__rl":true,"value":"appSt3GpYPstPjpl2","mode":"list","cachedResultName":"[People]- Instagram Followers","cachedResultU… | table={"__rl":true,"value":"tblR6Il1syV9muGlZ","mode":"list","cachedResultName":"Instagram Influencers","cachedResultUrl":"htt… | credentials=airtableTokenApi
40. **Update Posts**
   - type: `n8n-nodes-base.airtable`
   - disabled: false
   - summary: resource/op=update | options={"typecast":true} | base={"__rl":true,"value":"appSt3GpYPstPjpl2","mode":"list","cachedResultName":"[People]- Instagram Followers","cachedResultU… | table={"__rl":true,"value":"tblR6Il1syV9muGlZ","mode":"list","cachedResultName":"Instagram Influencers","cachedResultUrl":"htt… | credentials=airtableTokenApi
41. **Search influencer2**
   - type: `n8n-nodes-base.airtable`
   - disabled: false
   - summary: resource/op=search | base={"__rl":true,"value":"appSt3GpYPstPjpl2","mode":"list","cachedResultName":"[People]- Instagram Followers","cachedResultU… | table={"__rl":true,"value":"tblR6Il1syV9muGlZ","mode":"list","cachedResultName":"Instagram Influencers","cachedResultUrl":"htt… | formula==AND(NOT({Reminder Date Mentions} = ''), OR({Post} = 0, {Post} = ''), OR({History} = 0, {History} = '')) | credentials=airtableTokenApi
42. **Loop Over Items**
   - type: `n8n-nodes-base.splitInBatches`
   - disabled: false
43. **Replace Me**
   - type: `n8n-nodes-base.noOp`
   - disabled: false
44. **Wait 1 minute**
   - type: `n8n-nodes-base.wait`
   - disabled: false
45. **Wait 1 Day**
   - type: `n8n-nodes-base.wait`
   - disabled: false
46. **Update Delivered**
   - type: `n8n-nodes-base.airtable`
   - disabled: false
   - summary: resource/op=update | options={"typecast":true} | base={"__rl":true,"value":"appSt3GpYPstPjpl2","mode":"list","cachedResultName":"[People]- Instagram Followers","cachedResultU… | table={"__rl":true,"value":"tblR6Il1syV9muGlZ","mode":"list","cachedResultName":"Instagram Influencers","cachedResultUrl":"htt… | credentials=airtableTokenApi
47. **Upload to Cloudinary**
   - type: `n8n-nodes-base.httpRequest`
   - disabled: false
   - summary: method=POST | url=https://api.cloudinary.com/v1_1/dc7xz3fjg/auto/upload
48. **Binary Media**
   - type: `n8n-nodes-base.httpRequest`
   - disabled: false
   - summary: url=={{ $('If history').item.json.media_id }} | options={"response":{"response":{"responseFormat":"file"}}}
49. **Create History Mentions**
   - type: `n8n-nodes-base.airtable`
   - disabled: false
   - summary: resource/op=create | options={"typecast":true} | base={"__rl":true,"value":"appSt3GpYPstPjpl2","mode":"list","cachedResultName":"[People]- Instagram Followers","cachedResultU… | table={"__rl":true,"value":"tblUloopZCJyZD2WW","mode":"list","cachedResultName":"Mentions","cachedResultUrl":"https://airtable… | credentials=airtableTokenApi
50. **Create Posts Mentions**
   - type: `n8n-nodes-base.airtable`
   - disabled: false
   - summary: resource/op=create | options={"typecast":true} | base={"__rl":true,"value":"appSt3GpYPstPjpl2","mode":"list","cachedResultName":"[People]- Instagram Followers","cachedResultU… | table={"__rl":true,"value":"tblUloopZCJyZD2WW","mode":"list","cachedResultName":"Mentions","cachedResultUrl":"https://airtable… | credentials=airtableTokenApi
51. **Tags ?**
   - type: `n8n-nodes-base.filter`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":3},"conditions":[{"id":"25b451b6-c536-4f30-bcef-30f6cc87e3a9","leftValue":"={{ $json.tags_count }}","rightValue":0,"operator":{"type":"n…
52. **Sticky Note6**
   - type: `n8n-nodes-base.stickyNote`
   - disabled: false

### Connections
- Schedule Trigger [branch 0] -> Search influencer (type=main, input=0)
- Shopify Trigger [branch 0] -> Status Delivered  (type=main, input=0)
- PROD? [branch 0] -> Discord (type=main, input=0)
- Error Trigger [branch 0] -> PROD? (type=main, input=0)
- Create Email [branch 0] -> Reply to a message (type=main, input=0)
- Reply to a message [branch 0] -> Update Delivered Date (type=main, input=0)
- Status Delivered  [branch 0] -> Search records (type=main, input=0)
- Schedule Trigger1 [branch 0] -> Search influencer2 (type=main, input=0)
- Create Email1 [branch 0] -> Reply to a message1 (type=main, input=0)
- 2 days  [branch 0] -> Loop Over Items (type=main, input=0)
- IF Verify Token [branch 0] -> Extract Challenge (type=main, input=0)
- IF Verify Token [branch 1] -> Respond Error (type=main, input=0)
- Extract Challenge [branch 0] -> Respond Challenge (type=main, input=0)
- Webhook [branch 0] -> IF Verify Token (type=main, input=0)
- Map by Event Type [branch 0] -> If history (type=main, input=0)
- Get All IG Tags [branch 0] -> Match & Count (type=main, input=0)
- Match & Count [branch 0] -> Tags ? (type=main, input=0)
- Webhook Events [branch 0] -> Map by Event Type (type=main, input=0)
- Set params [branch 0] -> Update History (type=main, input=0)
- If history [branch 0] -> Get username (type=main, input=0)
- Get username [branch 0] -> Search influencer1 (type=main, input=0)
- Get username [branch 0] -> Binary Media (type=main, input=0)
- Search records [branch 0] -> Wait 1 Day (type=main, input=0)
- Search influencer [branch 0] -> Get All IG Tags (type=main, input=0)
- Search influencer1 [branch 0] -> Set params (type=main, input=0)
- Update History [branch 0] -> Respond 200 OK (type=main, input=0)
- Search influencer2 [branch 0] -> 2 days  (type=main, input=0)
- Loop Over Items [branch 1] -> Replace Me (type=main, input=0)
- Replace Me [branch 0] -> Create Email1 (type=main, input=0)
- Reply to a message1 [branch 0] -> Update Delivered (type=main, input=0)
- Wait 1 minute [branch 0] -> Loop Over Items (type=main, input=0)
- Wait 1 Day [branch 0] -> Create Email (type=main, input=0)
- Update Delivered [branch 0] -> Wait 1 minute (type=main, input=0)
- Upload to Cloudinary [branch 0] -> Create History Mentions (type=main, input=0)
- Binary Media [branch 0] -> Upload to Cloudinary (type=main, input=0)
- Tags ? [branch 0] -> Create Posts Mentions (type=main, input=0)
- Tags ? [branch 0] -> Update Posts (type=main, input=0)

## [AC] Costs COGS + Tools - Seeding Orders
- File: -AC-Costs-COGS-Tools---Seeding-Orders.json
- Workflow ID: zjgm4l9fldEaHxav
- Active: true
- Node count: 6
- Edge count: 5

### Nodes
1. **Calcular y Listar Pedidos**
   - type: `n8n-nodes-base.code`
   - disabled: false
   - summary: jsCode=const response = $input.first().json; const config = $('Configuración3').first().json; const targetVariantId = config.variant_id; const targetTag = config.tag_filter; if (response.errors) { throw new …
2. **Configuración3**
   - type: `n8n-nodes-base.set`
   - disabled: false
3. **Obtener Pedidos2**
   - type: `n8n-nodes-base.httpRequest`
   - disabled: false
   - summary: method=POST | url==https://{{ $json.shopify_store }}.myshopify.com/admin/api/2024-10/graphql.json | credentials=httpHeaderAuth
4. **Update record**
   - type: `n8n-nodes-base.airtable`
   - disabled: false
   - summary: resource/op=update | base={"__rl":true,"value":"appSt3GpYPstPjpl2","mode":"list","cachedResultName":"[People]- Instagram Followers","cachedResultU… | table={"__rl":true,"value":"tbluyYSIPiTWVFvQg","mode":"list","cachedResultName":"Cost","cachedResultUrl":"https://airtable.com… | credentials=airtableTokenApi
5. **Get Data1**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: documentId={"__rl":true,"value":"https://docs.google.com/spreadsheets/d/1yjoiKi91cfNAT-1FujXCPiI3GBKJhoNn3LmPMMbXNmk/edit?gid=23919… | sheet={"__rl":true,"value":219858667,"mode":"list","cachedResultName":"Cost Tools","cachedResultUrl":"https://docs.google.com/… | credentials=googleSheetsOAuth2Api
6. **Schedule Trigger**
   - type: `n8n-nodes-base.scheduleTrigger`
   - disabled: false

### Connections
- Configuración3 [branch 0] -> Obtener Pedidos2 (type=main, input=0)
- Obtener Pedidos2 [branch 0] -> Calcular y Listar Pedidos (type=main, input=0)
- Calcular y Listar Pedidos [branch 0] -> Get Data1 (type=main, input=0)
- Get Data1 [branch 0] -> Update record (type=main, input=0)
- Schedule Trigger [branch 0] -> Configuración3 (type=main, input=0)

## [AC] Message System [Draft]
- File: -AC-Message-System-Draft-.json
- Workflow ID: zCAQ4IjyvVc1cY1k
- Active: true
- Node count: 38
- Edge count: 37

### Nodes
1. **Normalize Provider ID**
   - type: `n8n-nodes-base.set`
   - disabled: false
2. **Attendee ?**
   - type: `n8n-nodes-base.if`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":1},"conditions":[{"id":"c69b6520-2e98-4def-8731-002fe9dab03f","leftValue":"={{ $json.found }}","rightValue":"","operator":{"type":"boole…
3. **Chat existente ?**
   - type: `n8n-nodes-base.if`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":1},"conditions":[{"id":"bac24659-66f1-44d7-a21d-448aa75e1ae4","leftValue":"={{ $json.id }}","rightValue":"","operator":{"type":"string",…
4. **Send Message in Existing Chat**
   - type: `n8n-nodes-base.httpRequest`
   - disabled: false
   - summary: method=POST | url==https://api11.unipile.com:14124/api/v1/chats/{{ $json.id }}/messages | credentials=httpBearerAuth,httpHeaderAuth
5. **Schedule Trigger**
   - type: `n8n-nodes-base.scheduleTrigger`
   - disabled: true
6. **Webhook**
   - type: `n8n-nodes-base.webhook`
   - disabled: false
   - summary: path=message-chat-instagram
7. **Start New Chat**
   - type: `n8n-nodes-base.httpRequest`
   - disabled: false
   - summary: method=POST | url=https://api11.unipile.com:14124/api/v1/chats | options={"timeout":100000000} | credentials=httpBearerAuth,httpHeaderAuth
8. **Get Provider ID**
   - type: `n8n-nodes-base.httpRequest`
   - disabled: false
   - summary: url==https://api11.unipile.com:14124/api/v1/users/{{$json.username}} | credentials=httpBearerAuth,httpHeaderAuth
9. **Get Data Send Email Username**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: options={"dataLocationOnSheet":{"values":{"rangeDefinition":"detectAutomatically"}}} | documentId={"__rl":true,"value":"https://docs.google.com/spreadsheets/d/1yjoiKi91cfNAT-1FujXCPiI3GBKJhoNn3LmPMMbXNmk/edit?gid=23919… | sheet={"__rl":true,"value":320906009,"mode":"list","cachedResultName":"Send Message Approved","cachedResultUrl":"https://docs.… | credentials=googleSheetsOAuth2Api
10. **Clean User**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: resource/op=delete | documentId={"__rl":true,"value":"https://docs.google.com/spreadsheets/d/1yjoiKi91cfNAT-1FujXCPiI3GBKJhoNn3LmPMMbXNmk/edit?gid=23919… | sheet={"__rl":true,"value":320906009,"mode":"list","cachedResultName":"Send Message Approved","cachedResultUrl":"https://docs.… | credentials=googleSheetsOAuth2Api
11. **Loop Over Items**
   - type: `n8n-nodes-base.splitInBatches`
   - disabled: false
12. **Replace Me**
   - type: `n8n-nodes-base.noOp`
   - disabled: false
13. **Wait**
   - type: `n8n-nodes-base.wait`
   - disabled: false
14. **Sticky Note**
   - type: `n8n-nodes-base.stickyNote`
   - disabled: false
15. **Active Workflow ?**
   - type: `n8n-nodes-base.if`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":[{"id":"0978d3fb-11a0-4743-8d76-a09c041bdf03","leftValue":"={{ $json.Locked }}","rightValue":0,"operator":{"type":"numbe…
16. **Read Active Workflow**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: documentId={"__rl":true,"value":"https://docs.google.com/spreadsheets/d/1yjoiKi91cfNAT-1FujXCPiI3GBKJhoNn3LmPMMbXNmk/edit?gid=23919… | sheet={"__rl":true,"value":361742329,"mode":"list","cachedResultName":"Controller","cachedResultUrl":"https://docs.google.com/… | credentials=googleSheetsOAuth2Api
17. **Error Trigger**
   - type: `n8n-nodes-base.errorTrigger`
   - disabled: false
18. **Discord**
   - type: `n8n-nodes-base.discord`
   - disabled: false
   - summary: credentials=discordWebhookApi
19. **PROD?**
   - type: `n8n-nodes-base.if`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":[{"id":"b089ee75-06af-4055-a4c7-1e3d66a08aa4","leftValue":"={{ $json.execution.mode }}","rightValue":"manual","operator"…
20. **Update True**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: resource/op=update | documentId={"__rl":true,"value":"https://docs.google.com/spreadsheets/d/1yjoiKi91cfNAT-1FujXCPiI3GBKJhoNn3LmPMMbXNmk/edit?gid=23919… | sheet={"__rl":true,"value":361742329,"mode":"list","cachedResultName":"Controller","cachedResultUrl":"https://docs.google.com/… | credentials=googleSheetsOAuth2Api
21. **Update Count**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: resource/op=update | documentId={"__rl":true,"value":"https://docs.google.com/spreadsheets/d/1yjoiKi91cfNAT-1FujXCPiI3GBKJhoNn3LmPMMbXNmk/edit?gid=23919… | sheet={"__rl":true,"value":361742329,"mode":"list","cachedResultName":"Controller","cachedResultUrl":"https://docs.google.com/… | credentials=googleSheetsOAuth2Api
22. **Get Count**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: options={"dataLocationOnSheet":{"values":{"rangeDefinition":"detectAutomatically"}}} | documentId={"__rl":true,"value":"https://docs.google.com/spreadsheets/d/1yjoiKi91cfNAT-1FujXCPiI3GBKJhoNn3LmPMMbXNmk/edit?gid=23919… | sheet={"__rl":true,"value":361742329,"mode":"list","cachedResultName":"Controller","cachedResultUrl":"https://docs.google.com/… | credentials=googleSheetsOAuth2Api
23. **Update False**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: resource/op=update | documentId={"__rl":true,"value":"https://docs.google.com/spreadsheets/d/1yjoiKi91cfNAT-1FujXCPiI3GBKJhoNn3LmPMMbXNmk/edit?gid=23919… | sheet={"__rl":true,"value":361742329,"mode":"list","cachedResultName":"Controller","cachedResultUrl":"https://docs.google.com/… | credentials=googleSheetsOAuth2Api
24. **20 message for day**
   - type: `n8n-nodes-base.if`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":[{"id":"1dee6222-e724-4d5b-a8f2-afce26c74478","leftValue":"={{$('Update Count').item.json.Locked }}","rightValue":"20","…
25. **Schedule Trigger1**
   - type: `n8n-nodes-base.scheduleTrigger`
   - disabled: true
26. **Update False2**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: resource/op=update | documentId={"__rl":true,"value":"https://docs.google.com/spreadsheets/d/1yjoiKi91cfNAT-1FujXCPiI3GBKJhoNn3LmPMMbXNmk/edit?gid=23919… | sheet={"__rl":true,"value":361742329,"mode":"list","cachedResultName":"Controller","cachedResultUrl":"https://docs.google.com/… | credentials=googleSheetsOAuth2Api
27. **Update False3**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: resource/op=update | documentId={"__rl":true,"value":"https://docs.google.com/spreadsheets/d/1yjoiKi91cfNAT-1FujXCPiI3GBKJhoNn3LmPMMbXNmk/edit?gid=23919… | sheet={"__rl":true,"value":361742329,"mode":"list","cachedResultName":"Controller","cachedResultUrl":"https://docs.google.com/… | credentials=googleSheetsOAuth2Api
28. **Update Count2**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: resource/op=update | documentId={"__rl":true,"value":"https://docs.google.com/spreadsheets/d/1yjoiKi91cfNAT-1FujXCPiI3GBKJhoNn3LmPMMbXNmk/edit?gid=23919… | sheet={"__rl":true,"value":361742329,"mode":"list","cachedResultName":"Controller","cachedResultUrl":"https://docs.google.com/… | credentials=googleSheetsOAuth2Api
29. **Sticky Note1**
   - type: `n8n-nodes-base.stickyNote`
   - disabled: false
30. **Get Email**
   - type: `n8n-nodes-base.code`
   - disabled: false
   - summary: jsCode=// Obtener el email del campo directo let email = $input.first().json.body.data.email; // Si el email es null o vacío, buscar en last_input_text if (!email) { const lastInputText = $input.first().json…
31. **Email ?**
   - type: `n8n-nodes-base.filter`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":[{"id":"4d1ea022-7ff2-45e5-ab8e-72366bf8ea19","leftValue":"={{ $json.email_found }}","rightValue":"","operator":{"type":…
32. **Search records**
   - type: `n8n-nodes-base.airtable`
   - disabled: false
   - summary: resource/op=search | base={"__rl":true,"value":"appSt3GpYPstPjpl2","mode":"list","cachedResultName":"[People]- Instagram Followers","cachedResultU… | table={"__rl":true,"value":"tblR6Il1syV9muGlZ","mode":"list","cachedResultName":"Instagram Influencers","cachedResultUrl":"htt… | formula=={Username} = "{{ $('Webhook').item.json.body.data.ig_username }}" | credentials=airtableTokenApi
33. **Exist ?1**
   - type: `n8n-nodes-base.if`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":[{"id":"892f74fa-8bff-491a-9ea1-3909681319b8","leftValue":"={{ $json.Username }}","rightValue":"","operator":{"type":"st…
34. **Update Email Sheet**
   - type: `n8n-nodes-base.airtable`
   - disabled: false
   - summary: resource/op=update | options={"typecast":true} | base={"__rl":true,"value":"appSt3GpYPstPjpl2","mode":"list","cachedResultName":"[People]- Instagram Followers","cachedResultU… | table={"__rl":true,"value":"tblR6Il1syV9muGlZ","mode":"list","cachedResultName":"Instagram Influencers","cachedResultUrl":"htt… | credentials=airtableTokenApi
35. **Update Email Master Seeding**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: resource/op=update | documentId={"__rl":true,"value":"1pgnO3ooeoqAbrrOkNQ5JSRRGH__oNSjp9-pRIZS229M","mode":"list","cachedResultName":"Master Seeding She… | sheet={"__rl":true,"value":1922746286,"mode":"list","cachedResultName":"Influencer PR","cachedResultUrl":"https://docs.google.… | credentials=googleSheetsOAuth2Api
36. **Username ?**
   - type: `n8n-nodes-base.if`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":[{"id":"7b0ada25-25b6-4e3f-9508-b5ffa27f23e4","leftValue":"={{ $json.username }}","rightValue":"","operator":{"type":"st…
37. **Search (Cursor Pagination)**
   - type: `n8n-nodes-base.code`
   - disabled: false
   - summary: jsCode=// VERSIÓN CON CURSOR-BASED PAGINATION // (Si el offset no funciona, Unipile probablemente usa cursor) const accountId = $vars.ChatInstagramAttendee_id; const providerIdToFind = $input.first().json.pr…
38. **List & Search Chat (Paginado)**
   - type: `n8n-nodes-base.code`
   - disabled: false
   - summary: jsCode=// PAGINACIÓN CON CURSOR para buscar chat por provider_id const accountId = $input.first().json.account_id; const providerIdToFind = $('Normalize Provider ID').first().json.provider_messaging_id const…

### Connections
- Normalize Provider ID [branch 0] -> Search (Cursor Pagination) (type=main, input=0)
- Attendee ? [branch 0] -> List & Search Chat (Paginado) (type=main, input=0)
- Attendee ? [branch 1] -> Start New Chat (type=main, input=0)
- Chat existente ? [branch 0] -> Send Message in Existing Chat (type=main, input=0)
- Chat existente ? [branch 1] -> Start New Chat (type=main, input=0)
- Schedule Trigger [branch 0] -> Read Active Workflow (type=main, input=0)
- Send Message in Existing Chat [branch 0] -> Get Count (type=main, input=0)
- Start New Chat [branch 0] -> Get Count (type=main, input=0)
- Get Provider ID [branch 0] -> Normalize Provider ID (type=main, input=0)
- Get Data Send Email Username [branch 0] -> Username ? (type=main, input=0)
- Loop Over Items [branch 0] -> Update False (type=main, input=0)
- Loop Over Items [branch 1] -> Replace Me (type=main, input=0)
- Replace Me [branch 0] -> Get Provider ID (type=main, input=0)
- Wait [branch 0] -> Loop Over Items (type=main, input=0)
- Read Active Workflow [branch 0] -> Active Workflow ? (type=main, input=0)
- Active Workflow ? [branch 0] -> Update True (type=main, input=0)
- PROD? [branch 0] -> Discord (type=main, input=0)
- PROD? [branch 1] -> Update False3 (type=main, input=0)
- Error Trigger [branch 0] -> PROD? (type=main, input=0)
- Update True [branch 0] -> Get Data Send Email Username (type=main, input=0)
- Update Count [branch 0] -> Clean User (type=main, input=0)
- Get Count [branch 0] -> Update Count (type=main, input=0)
- Clean User [branch 0] -> 20 message for day (type=main, input=0)
- 20 message for day [branch 1] -> Wait (type=main, input=0)
- Schedule Trigger1 [branch 0] -> Update False3 (type=main, input=0)
- Discord [branch 0] -> Update False2 (type=main, input=0)
- Update False3 [branch 0] -> Update Count2 (type=main, input=0)
- Webhook [branch 0] -> Get Email (type=main, input=0)
- Get Email [branch 0] -> Email ? (type=main, input=0)
- Search records [branch 0] -> Exist ?1 (type=main, input=0)
- Exist ?1 [branch 0] -> Update Email Sheet (type=main, input=0)
- Email ? [branch 0] -> Search records (type=main, input=0)
- Update Email Sheet [branch 0] -> Update Email Master Seeding (type=main, input=0)
- Username ? [branch 0] -> Update False (type=main, input=0)
- Username ? [branch 1] -> Loop Over Items (type=main, input=0)
- Search (Cursor Pagination) [branch 0] -> Attendee ? (type=main, input=0)
- List & Search Chat (Paginado) [branch 0] -> Chat existente ? (type=main, input=0)

## Delivery Bot
- File: Delivery-Bot.json
- Workflow ID: oeTBIo37i5J99IFH
- Active: true
- Node count: 11
- Edge count: 8

### Nodes
1. **Webhook**
   - type: `n8n-nodes-base.webhook`
   - disabled: false
   - summary: path=shopify/fulfillment-created
2. **Google Sheets**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: resource/op=update | documentId={"__rl":true,"value":"https://docs.google.com/spreadsheets/d/1pgnO3ooeoqAbrrOkNQ5JSRRGH__oNSjp9-pRIZS229M/edit?gid=19227… | sheet={"__rl":true,"value":1922746286,"mode":"list","cachedResultName":"Influencer PR","cachedResultUrl":"https://docs.google.… | credentials=googleSheetsOAuth2Api
3. **Google Sheets1**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: resource/op=update | documentId={"__rl":true,"value":"https://docs.google.com/spreadsheets/d/1pgnO3ooeoqAbrrOkNQ5JSRRGH__oNSjp9-pRIZS229M/edit?usp=shari… | sheet={"__rl":true,"value":1922746286,"mode":"list","cachedResultName":"Influencer PR","cachedResultUrl":"https://docs.google.… | credentials=googleSheetsOAuth2Api
4. **If**
   - type: `n8n-nodes-base.if`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":false,"leftValue":"","typeValidation":"loose","version":2},"conditions":[{"id":"66d92b1f-5068-4607-a4a4-94ccb01b7a41","leftValue":"={{ $json.body.shipment_status }}","rightValue":"delivered","… | options={"ignoreCase":true}
5. **Google Sheets Trigger**
   - type: `n8n-nodes-base.googleSheetsTrigger`
   - disabled: false
   - summary: pollTimes={"item":[{"mode":"everyMinute"}]} | options={"columnsToWatch":["Tracking #"]} | documentId={"__rl":true,"value":"https://docs.google.com/spreadsheets/d/1pgnO3ooeoqAbrrOkNQ5JSRRGH__oNSjp9-pRIZS229M/edit?usp=shari… | sheet={"__rl":true,"value":1922746286,"mode":"list","cachedResultName":"Influencer PR","cachedResultUrl":"https://docs.google.… | credentials=googleSheetsTriggerOAuth2Api
6. **HTTP Request**
   - type: `n8n-nodes-base.httpRequest`
   - disabled: false
   - summary: method=POST | url=https://api.17track.net/track/v2/register
7. **Webhook1**
   - type: `n8n-nodes-base.webhook`
   - disabled: false
   - summary: path=17track/update
8. **Google Sheets2**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: resource/op=update | documentId={"__rl":true,"value":"https://docs.google.com/spreadsheets/d/1pgnO3ooeoqAbrrOkNQ5JSRRGH__oNSjp9-pRIZS229M/edit?usp=shari… | sheet={"__rl":true,"value":1922746286,"mode":"list","cachedResultName":"Influencer PR","cachedResultUrl":"https://docs.google.… | credentials=googleSheetsOAuth2Api
9. **If1**
   - type: `n8n-nodes-base.if`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":false,"leftValue":"","typeValidation":"loose","version":2},"conditions":[{"id":"35ad3258-3212-42e3-b079-840fe4656ab8","leftValue":"={{ $json.body.data.track_info.latest_status.status }}","righ… | options={"ignoreCase":true}
10. **Wait**
   - type: `n8n-nodes-base.wait`
   - disabled: false
11. **Gmail**
   - type: `n8n-nodes-base.gmail`
   - disabled: true
   - summary: resource/op=thread | gmailOp=reply | credentials=gmailOAuth2

### Connections
- Webhook [branch 0] -> If (type=main, input=0)
- If [branch 0] -> Google Sheets1 (type=main, input=0)
- If [branch 1] -> Google Sheets (type=main, input=0)
- Google Sheets Trigger [branch 0] -> HTTP Request (type=main, input=0)
- Webhook1 [branch 0] -> If1 (type=main, input=0)
- Google Sheets2 [branch 0] -> Wait (type=main, input=0)
- If1 [branch 0] -> Google Sheets2 (type=main, input=0)
- Wait [branch 0] -> Gmail (type=main, input=0)

## Draft Order Maker
- File: Draft-Order-Maker.json
- Workflow ID: xB3LRJgzptdplswq
- Active: true
- Node count: 9
- Edge count: 6

### Nodes
1. **Shopify**
   - type: `n8n-nodes-base.shopify`
   - disabled: false
   - summary: credentials=shopifyAccessTokenApi
2. **Filter**
   - type: `n8n-nodes-base.filter`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":true,"leftValue":"","typeValidation":"loose","version":2},"conditions":[{"id":"7dd17e28-3b0b-474e-952f-662db03726bb","leftValue":"={{ $json['Approved?'] }}","rightValue":"Yes","operator":{"typ…
3. **Google Sheets**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: resource/op=appendOrUpdate | documentId={"__rl":true,"value":"https://docs.google.com/spreadsheets/d/1pgnO3ooeoqAbrrOkNQ5JSRRGH__oNSjp9-pRIZS229M/edit?usp=shari… | sheet={"__rl":true,"value":1922746286,"mode":"list","cachedResultName":"Influencer PR","cachedResultUrl":"https://docs.google.… | credentials=googleSheetsOAuth2Api
4. **Google Sheets1**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: resource/op=appendOrUpdate | documentId={"__rl":true,"value":"https://docs.google.com/spreadsheets/d/1pgnO3ooeoqAbrrOkNQ5JSRRGH__oNSjp9-pRIZS229M/edit?usp=shari… | sheet={"__rl":true,"value":1922746286,"mode":"list","cachedResultName":"Influencer PR","cachedResultUrl":"https://docs.google.… | credentials=googleSheetsOAuth2Api
5. **Shopify2**
   - type: `n8n-nodes-base.shopify`
   - disabled: false
   - summary: credentials=shopifyAccessTokenApi
6. **Shopify Order Created?**
   - type: `n8n-nodes-base.if`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":[{"id":"6d0326bc-c797-4fd6-8304-898180a108a7","leftValue":"={{ $json[\"Shopify Order Created?\"] }}","rightValue":"","op…
7. **Address Splitter and Last Name Logic**
   - type: `n8n-nodes-base.code`
   - disabled: false
   - summary: jsCode=// Loop through every single item that the node receives for (const item of items) { // --- Address Parsing and Cleaning --- // 1. Handle the Street/Apartment split const fullStreet = item.json.Street…
8. **If Last Name is Empty**
   - type: `n8n-nodes-base.if`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":[{"id":"4cfefa63-72ee-4fd0-be34-f8600b46c7fd","leftValue":"={{ $json[\"Last Name\"] }}","rightValue":"","operator":{"typ…
9. **Google Sheets Trigger if row is added**
   - type: `n8n-nodes-base.googleSheetsTrigger`
   - disabled: false
   - summary: pollTimes={"item":[{"mode":"everyMinute"}]} | documentId={"__rl":true,"value":"https://docs.google.com/spreadsheets/d/1pgnO3ooeoqAbrrOkNQ5JSRRGH__oNSjp9-pRIZS229M/edit?usp=shari… | sheet={"__rl":true,"value":1327022888,"mode":"list","cachedResultName":"Ready for Shopify","cachedResultUrl":"https://docs.goo… | credentials=googleSheetsTriggerOAuth2Api

### Connections
- Filter [branch 0] -> If Last Name is Empty (type=main, input=0)
- Shopify [branch 0] -> Google Sheets1 (type=main, input=0)
- Shopify2 [branch 0] -> Google Sheets (type=main, input=0)
- Shopify Order Created? [branch 0] -> Filter (type=main, input=0)
- If Last Name is Empty [branch 0] -> Address Splitter and Last Name Logic (type=main, input=0)
- Google Sheets Trigger if row is added [branch 0] -> Shopify Order Created? (type=main, input=0)

## Refunnel tracker
- File: Refunnel-tracker.json
- Workflow ID: VzY9hbxcFBOiuC3w
- Active: true
- Node count: 21
- Edge count: 20

### Nodes
1. **Slack Trigger**
   - type: `n8n-nodes-base.slackTrigger`
   - disabled: false
   - summary: credentials=slackApi
2. **Code**
   - type: `n8n-nodes-base.code`
   - disabled: false
   - summary: jsCode=/** * 1) Recursively collect every string in the Slack payload (including nested blocks/attachments). * 2) Join them into one line, strip Slack’s <url|text> formatting. * 3) Extract handle, platform, …
3. **Google Sheets1**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: resource/op=append | documentId={"__rl":true,"value":"1pgnO3ooeoqAbrrOkNQ5JSRRGH__oNSjp9-pRIZS229M","mode":"list","cachedResultName":"Master Seeding She… | sheet={"__rl":true,"value":1922746286,"mode":"list","cachedResultName":"Influencer PR","cachedResultUrl":"https://docs.google.… | credentials=googleSheetsOAuth2Api
4. **Google Sheets4**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: documentId={"__rl":true,"value":"1pgnO3ooeoqAbrrOkNQ5JSRRGH__oNSjp9-pRIZS229M","mode":"list","cachedResultName":"KALM INFLUENCER TR… | sheet={"__rl":true,"value":1922746286,"mode":"list","cachedResultName":"Influencer PR","cachedResultUrl":"https://docs.google.… | credentials=googleSheetsOAuth2Api
5. **If**
   - type: `n8n-nodes-base.if`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":false,"leftValue":"","typeValidation":"loose","version":2},"conditions":[{"id":"343cc8fd-2d73-40e1-a7a1-ef6958967038","leftValue":"={{ $json.platform }}","rightValue":"=Instagram","operator":{… | options={"ignoreCase":true}
6. **Google Sheets6**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: resource/op=update | documentId={"__rl":true,"value":"1pgnO3ooeoqAbrrOkNQ5JSRRGH__oNSjp9-pRIZS229M","mode":"list","cachedResultName":"Master Seeding She… | sheet={"__rl":true,"value":549594144,"mode":"list","cachedResultName":"Content Pushers","cachedResultUrl":"https://docs.google… | credentials=googleSheetsOAuth2Api
7. **Google Sheets7**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: resource/op=update | documentId={"__rl":true,"value":"1pgnO3ooeoqAbrrOkNQ5JSRRGH__oNSjp9-pRIZS229M","mode":"list","cachedResultName":"Master Seeding She… | sheet={"__rl":true,"value":549594144,"mode":"list","cachedResultName":"Content Pushers","cachedResultUrl":"https://docs.google… | credentials=googleSheetsOAuth2Api
8. **Edit Fields**
   - type: `n8n-nodes-base.set`
   - disabled: false
9. **Google Sheets10**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: documentId={"__rl":true,"value":"1pgnO3ooeoqAbrrOkNQ5JSRRGH__oNSjp9-pRIZS229M","mode":"list","cachedResultName":"KALM INFLUENCER TR… | sheet={"__rl":true,"value":1922746286,"mode":"list","cachedResultName":"Influencer PR","cachedResultUrl":"https://docs.google.… | credentials=googleSheetsOAuth2Api
10. **If2**
   - type: `n8n-nodes-base.if`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":false,"leftValue":"","typeValidation":"loose","version":2},"conditions":[{"id":"d9244e93-0995-44dc-8665-3f565d054573","leftValue":"={{ $json.isEmpty() }}","rightValue":"=","operator":{"type":"… | options={"ignoreCase":true}
11. **Google Sheets**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: resource/op=update | documentId={"__rl":true,"value":"1pgnO3ooeoqAbrrOkNQ5JSRRGH__oNSjp9-pRIZS229M","mode":"list","cachedResultName":"Master Seeding She… | sheet={"__rl":true,"value":549594144,"mode":"list","cachedResultName":"Content Pushers","cachedResultUrl":"https://docs.google… | credentials=googleSheetsOAuth2Api
12. **Edit Fields1**
   - type: `n8n-nodes-base.set`
   - disabled: false
13. **Google Sheets2**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: resource/op=append | documentId={"__rl":true,"value":"1pgnO3ooeoqAbrrOkNQ5JSRRGH__oNSjp9-pRIZS229M","mode":"list","cachedResultName":"Master Seeding She… | sheet={"__rl":true,"value":549594144,"mode":"list","cachedResultName":"Content Pushers","cachedResultUrl":"https://docs.google… | credentials=googleSheetsOAuth2Api
14. **Google Sheets5**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: documentId={"__rl":true,"value":"1pgnO3ooeoqAbrrOkNQ5JSRRGH__oNSjp9-pRIZS229M","mode":"list","cachedResultName":"KALM INFLUENCER TR… | sheet={"__rl":true,"value":1922746286,"mode":"list","cachedResultName":"Influencer PR","cachedResultUrl":"https://docs.google.… | credentials=googleSheetsOAuth2Api
15. **Google Sheets8**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: resource/op=update | documentId={"__rl":true,"value":"1pgnO3ooeoqAbrrOkNQ5JSRRGH__oNSjp9-pRIZS229M","mode":"list","cachedResultName":"Master Seeding She… | sheet={"__rl":true,"value":549594144,"mode":"list","cachedResultName":"Content Pushers","cachedResultUrl":"https://docs.google… | credentials=googleSheetsOAuth2Api
16. **Google Sheets9**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: resource/op=update | documentId={"__rl":true,"value":"1pgnO3ooeoqAbrrOkNQ5JSRRGH__oNSjp9-pRIZS229M","mode":"list","cachedResultName":"Master Seeding She… | sheet={"__rl":true,"value":549594144,"mode":"list","cachedResultName":"Content Pushers","cachedResultUrl":"https://docs.google… | credentials=googleSheetsOAuth2Api
17. **Edit Fields2**
   - type: `n8n-nodes-base.set`
   - disabled: false
18. **Google Sheets11**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: documentId={"__rl":true,"value":"1pgnO3ooeoqAbrrOkNQ5JSRRGH__oNSjp9-pRIZS229M","mode":"list","cachedResultName":"KALM INFLUENCER TR… | sheet={"__rl":true,"value":1922746286,"mode":"list","cachedResultName":"Influencer PR","cachedResultUrl":"https://docs.google.… | credentials=googleSheetsOAuth2Api
19. **If3**
   - type: `n8n-nodes-base.if`
   - disabled: false
   - summary: conditions={"options":{"caseSensitive":false,"leftValue":"","typeValidation":"loose","version":2},"conditions":[{"id":"d9244e93-0995-44dc-8665-3f565d054573","leftValue":"={{ $json.isEmpty() }}","rightValue":"=","operator":{"type":"… | options={"ignoreCase":true}
20. **Google Sheets3**
   - type: `n8n-nodes-base.googleSheets`
   - disabled: false
   - summary: resource/op=update | documentId={"__rl":true,"value":"1pgnO3ooeoqAbrrOkNQ5JSRRGH__oNSjp9-pRIZS229M","mode":"list","cachedResultName":"Master Seeding She… | sheet={"__rl":true,"value":549594144,"mode":"list","cachedResultName":"Content Pushers","cachedResultUrl":"https://docs.google… | credentials=googleSheetsOAuth2Api
21. **Edit Fields3**
   - type: `n8n-nodes-base.set`
   - disabled: false

### Connections
- Slack Trigger [branch 0] -> Code (type=main, input=0)
- Code [branch 0] -> If (type=main, input=0)
- Google Sheets1 [branch 0] -> Edit Fields1 (type=main, input=0)
- Google Sheets4 [branch 0] -> Google Sheets10 (type=main, input=0)
- If [branch 0] -> Google Sheets4 (type=main, input=0)
- If [branch 1] -> Google Sheets5 (type=main, input=0)
- Google Sheets6 [branch 0] -> Edit Fields (type=main, input=0)
- Edit Fields [branch 0] -> Google Sheets7 (type=main, input=0)
- Google Sheets10 [branch 0] -> If2 (type=main, input=0)
- If2 [branch 0] -> Google Sheets1 (type=main, input=0)
- If2 [branch 1] -> Google Sheets6 (type=main, input=0)
- Edit Fields1 [branch 0] -> Google Sheets (type=main, input=0)
- Google Sheets2 [branch 0] -> Edit Fields3 (type=main, input=0)
- Google Sheets5 [branch 0] -> Google Sheets11 (type=main, input=0)
- Google Sheets8 [branch 0] -> Edit Fields2 (type=main, input=0)
- Edit Fields2 [branch 0] -> Google Sheets9 (type=main, input=0)
- Google Sheets11 [branch 0] -> If3 (type=main, input=0)
- If3 [branch 0] -> Google Sheets2 (type=main, input=0)
- If3 [branch 1] -> Google Sheets8 (type=main, input=0)
- Edit Fields3 [branch 0] -> Google Sheets3 (type=main, input=0)

