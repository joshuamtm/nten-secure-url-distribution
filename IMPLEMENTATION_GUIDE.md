# Implementation Guide: Secure URL Distribution System

## Executive Summary

This guide provides a complete solution for distributing unique URLs to program participants securely and automatically. Using Google's free Apps Script platform, participants can retrieve their personal URL instantly, 24/7, by entering their unique access code—no staff intervention required. The system is designed for non-technical users to implement in approximately 30-45 minutes.

## Problem Definition

**Current Challenge:**
- Organization has unique URLs for each program participant
- Each participant has a corresponding unique access code
- Staff currently handles URL distribution manually via email
- Participants must wait for business hours/next day for URL reminders
- URLs must remain secure—participants shouldn't access others' URLs

**Requirements:**
- Instant, automated URL retrieval using access codes
- Available 24/7 without staff intervention
- Secure against unauthorized access
- Simple for participants to use
- Easy for non-technical staff to maintain

## Solution Approach & Rationale

**What We're Building:**
A simple web page where participants enter their access code and instantly see their unique URL on screen. Think of it like a digital lockbox—only the right key (code) opens the right box (URL).

**Why Google Apps Script Web App:**
- **Free forever** - No hosting costs or subscriptions
- **Instant display** - Shows URL immediately on screen (unlike Google Forms)
- **Secure** - URLs stay on Google's servers, never exposed in code
- **Professional** - Custom branded experience for participants
- **Simple maintenance** - Update participants in a spreadsheet like Excel

**Security Features Built-In:**
- Rate limiting prevents automated guessing attempts
- Audit logging tracks all access attempts
- Optional CAPTCHA blocks bots
- Codes are case-insensitive for user convenience
- Server-side validation ensures URLs never leak

## Step-by-Step Implementation Guide

### Phase 1: Create Your Google Sheet (5 minutes)

1. **Open Google Sheets** and create a new spreadsheet
2. **Name it** something like "Program URL Distribution"
3. **Create two tabs** (sheets) at the bottom:
   - Rename "Sheet1" to `Participants`
   - Add a new sheet called `AuditLog`

4. **Set up the Participants sheet:**
   - In cell A1, type: `Code`
   - In cell B1, type: `URL`
   - In cell C1, type: `Active`
   - In cell D1, type: `Notes` (optional)

5. **Set up the AuditLog sheet:**
   - Copy and paste this header row into row 1:
   ```
   Timestamp | Action | CodeHash | Success | Message | UserAgent | RecaptchaScore | BlockedUntil | LatencyMs | RequestId
   ```

6. **Add your participant data to the Participants sheet:**
   - Column A: Enter each participant's unique code (e.g., "ABC123XYZ")
   - Column B: Enter their corresponding URL
   - Column C: Enter TRUE for active participants
   - Column D: Optional notes for your reference

7. **Copy the Spreadsheet ID:**
   - Look at your sheet's URL: `https://docs.google.com/spreadsheets/d/YOUR-ID-HERE/edit`
   - Copy the long ID between `/d/` and `/edit`
   - Save this somewhere—you'll need it soon

### Phase 2: Set Up the Apps Script Project (10 minutes)

1. **From your Google Sheet**, click `Extensions` → `Apps Script`
2. **Delete any default code** you see
3. **Create three files** (using the + button next to Files):
   - Keep `Code.gs` (rename if needed)
   - Add `index.html`
   - Add `result.html`

4. **Copy the Code.gs content:**
   - Copy the entire Code.gs section from the `/src` folder
   - Paste it into your Code.gs file
   - Find the line `SPREADSHEET_ID: 'PUT-SPREADSHEET-ID-HERE'`
   - Replace `PUT-SPREADSHEET-ID-HERE` with your actual spreadsheet ID from Phase 1

5. **Copy the index.html content:**
   - Copy the entire index.html section from the `/src` folder
   - Paste it into your index.html file
   - For now, leave the CAPTCHA site key as-is (we'll address this later)

6. **Copy the result.html content:**
   - Copy the entire result.html section from the `/src` folder
   - Paste it into your result.html file
   - No changes needed here

### Phase 3: Configure Security Settings (5 minutes)

1. **In Apps Script, click the gear icon** (Project Settings) on the left
2. **Scroll down to "Script properties"**
3. **Add property:** Click "Add script property"
   - Property: `HASH_SALT`
   - Value: Type a random string of 20+ characters (like a password)
   - Example: `xK9mP2nQ8vT4wR6yL3s`
   - Save this value somewhere safe—you won't be able to see it again

4. **Optional: Set up CAPTCHA** (skip if you want to test first)
   - If you want bot protection, visit [Google reCAPTCHA](https://www.google.com/recaptcha/admin)
   - Register a new site (v2 Checkbox type)
   - Add another script property:
     - Property: `RECAPTCHA_SECRET`
     - Value: Your secret key from reCAPTCHA
   - In index.html, replace `PUT_YOUR_SITE_KEY_HERE` with your site key

### Phase 4: Deploy Your Web App (5 minutes)

1. **Save all files** (Ctrl+S or Cmd+S)
2. **Click "Deploy"** button (top right) → "New deployment"
3. **Configure deployment:**
   - Type: Select "Web app"
   - Description: "Initial deployment" (or any note you want)
   - Execute as: **Me** (your account)
   - Who has access: **Anyone** (don't worry—codes still required!)
4. **Click "Deploy"**
5. **Authorize the app:**
   - Click "Authorize access"
   - Choose your Google account
   - If you see a warning, click "Advanced" → "Go to [project name] (unsafe)"
   - This is normal for personal scripts—it's your own code
   - Click "Allow"
6. **Copy the Web App URL** that appears
   - This is what you'll share with participants
   - It looks like: `https://script.google.com/macros/s/[long-id]/exec`

### Phase 5: Restrict Sheet Access (2 minutes)

**Important:** Lock down your spreadsheet so only you can see the data:

1. **Go back to your Google Sheet**
2. **Click Share button** (top right)
3. **Under "General access"**, ensure it says "Restricted"
4. **Only share with specific staff** who need to manage participants
5. The web app will still work—it runs with your permissions

## Testing Your System

### Initial Tests:
1. **Visit your web app URL** in a browser
2. **Test with a valid code:**
   - Enter a code from your spreadsheet
   - You should immediately see the corresponding URL
3. **Test with an invalid code:**
   - Enter "WRONGCODE"
   - You should see an error message
4. **Test rate limiting:**
   - Enter wrong codes 6 times rapidly
   - System should block you temporarily (15 minutes)
5. **Check the AuditLog sheet:**
   - You should see entries for each attempt
   - This helps track usage and detect issues

### Troubleshooting Common Issues:

**"Script function not found: doGet"**
- Make sure Code.gs is saved
- Check that function names weren't changed

**No URL appears after entering valid code:**
- Verify the code in your sheet matches exactly (though case doesn't matter)
- Ensure the Active column says TRUE for that participant
- Check that your spreadsheet ID is correct in Code.gs

**"Authorization required" error:**
- Redeploy and complete the authorization steps
- Make sure deployment is set to "Execute as: Me"

## Ongoing Maintenance

### Adding New Participants:
1. Open your Google Sheet
2. Add new row with Code, URL, and TRUE in Active column
3. Changes take effect immediately—no republishing needed

### Deactivating Participants:
1. Find the participant in your sheet
2. Change their Active column from TRUE to FALSE
3. Their code stops working instantly

### Monitoring Usage:
- Check the AuditLog sheet regularly
- Look for patterns of failed attempts
- Export to analyze participation rates

### Updating the Web App:
If you need to change the code later:
1. Make changes in Apps Script
2. Click Deploy → Manage deployments
3. Click the pencil icon → Version → New version
4. Deploy the new version
5. The URL stays the same

## Security Best Practices

### For Access Codes:
- Use 10+ character codes with mix of letters/numbers
- Don't use predictable patterns (ABC001, ABC002, etc.)
- Consider codes like: `P7X9-K2M4-R8N3`
- Different codes for different program cohorts

### For URLs:
- Ensure destination URLs have their own security if needed
- Consider URL expiration if highly sensitive
- Remember: anyone with the URL can access it

### Regular Maintenance:
- Review AuditLog weekly for suspicious patterns
- Clear old audit logs after 90 days if not needed
- Update inactive participants promptly
- Change HASH_SALT if system is compromised

## What Participants See

When participants visit your web app:

1. **Entry Page:**
   - Clean, professional form
   - Single field for their access code
   - Clear instructions

2. **Success Page:**
   - Their unique URL displayed immediately
   - Suggestion to bookmark for future reference
   - No other participants' information visible

3. **Error Page:**
   - Generic error message (doesn't reveal if code exists)
   - Link to try again
   - No sensitive information exposed

## Email Notifications (Optional Advanced Feature)

To email URLs to participants automatically:
1. In Code.gs, find the success section
2. Add after the `logEvent` line:
```javascript
MailApp.sendEmail({
  to: "participant@email.com", // You'd need to store emails
  subject: "Your Program Link",
  body: "Your unique link: " + url
});
```
Note: Google limits to 100 emails/day on free accounts

## Support Resources

- **Google Apps Script Documentation:** https://developers.google.com/apps-script
- **Community Forums:** Google Apps Script Community on Stack Overflow
- **This Implementation:** Keep this guide bookmarked for reference

## Final Notes

This system provides enterprise-level functionality at zero cost. It's been designed to be maintainable by non-technical staff while providing robust security and excellent user experience. The audit logging ensures you can always track what's happening, and the rate limiting prevents abuse.

Remember: The simpler you keep the system, the more reliable it will be. This implementation strikes the right balance between functionality and maintainability for most nonprofit program needs.