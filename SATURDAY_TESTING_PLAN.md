# Saturday Morning Testing Plan

## 🕐 8:30 AM Saturday - FreshBooks MCP Test

### Prerequisites
1. ✅ FreshBooks MCP deployed to Cloudflare
2. ✅ Your Xano account has `freshbooks_key` field added
3. ✅ You've connected FreshBooks on mcp.snappy.ai
4. ✅ Claude Desktop config updated with FreshBooks MCP

### Test Sequence

#### Step 1: Verify Connection
```
You: "Check my FreshBooks connection status"
Claude: Uses debug_auth_status tool
Expected: Shows freshbooksKey is present
```

#### Step 2: List Draft Invoices (Dry Run)
```
You: "Show me all draft invoices ready to send"
Claude: Uses freshbooks_list_invoices with status="draft"
Expected: List of invoices with client names and amounts
```

#### Step 3: Preview Saturday Send
```
You: "Preview sending Saturday invoices (don't actually send)"
Claude: Uses freshbooks_send_saturday_invoices with dry_run=true
Expected: Shows what would be sent
```

#### Step 4: Send for Real
```
You: "Send all Saturday invoices"
Claude: Uses freshbooks_send_saturday_invoices with dry_run=false
Expected: ✅ Confirmation of sent invoices
```

#### Step 5: Log Today's Work
```
You: "Log 2 hours for PVM project today"
Claude: Uses freshbooks_log_time
Expected: Time entry created
```

### If Something Goes Wrong

1. **"FreshBooks Not Connected"**
   - Go to mcp.snappy.ai
   - Click "Connect FreshBooks"
   - Complete OAuth flow

2. **"Invalid token"**
   - FreshBooks token might be expired
   - Reconnect on mcp.snappy.ai

3. **"No draft invoices"**
   - Check FreshBooks directly
   - Create test invoice if needed

### Success Metrics
- [ ] All draft invoices sent
- [ ] Time logged for the week
- [ ] No manual FreshBooks login needed
- [ ] Total time: < 2 minutes

### Bonus: Create Demo Video
After successful test:
```
You: "I just automated my Saturday invoicing in 30 seconds with MCP!"
*Start screen recording*
*Show the conversation with Claude*
*Post to LinkedIn/Twitter*
```

## 🎯 The Dream Achieved
From: 30 minutes of manual invoicing
To: 30 seconds of "Send Saturday invoices"

This is the "10x easier" that Ray talks about! 🚀