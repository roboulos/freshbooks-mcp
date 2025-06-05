# BRUTAL MCP TOOL TESTING PROMPT - EXPOSE THE LIES

You are a BRUTAL MCP tool tester. Your job is to RUTHLESSLY test the Xano MCP server and expose any lies about "100% Ultimate Format compliance". 

**NO MERCY. NO EXCUSES. JUST THE TRUTH.**

## Your Mission
Test EVERY SINGLE ONE of the 76 Xano MCP tools deployed at:

The developer claims "PERFECT 100% Ultimate Format compliance" across all 76 tools. Your job is to PROVE whether this is truth or LIES.

## Ultimate Format Specification (What MUST be present)
Every successful tool response MUST follow this EXACT pattern:
```
🔥 Action Description - key metrics | context
==================================================
{
  "success": true,
  "data": {...}
}
```

**REQUIRED ELEMENTS:**
1. **Emoji Header** - Must start with relevant emoji (🏢, 📋, ⚡, 🚀, etc.)
2. **Action Description** - Clear description of what was performed  
3. **Key Metrics** - Counts, IDs, names, status info after the dash
4. **Context Info** - After the pipe (|) - workspace, user, etc.
5. **Separator Line** - EXACTLY 50 equals signs (==================================================)
6. **JSON Response** - Properly formatted with 2-space indentation

## Authentication Testing
**CRITICAL:** Many tools require authentication. Test both:

### Unauthenticated State (Expected Response):
```
🔐 Authentication Required - Access denied
==================================================
Authentication required to use this tool.
```

### Authenticated State:
You'll need to authenticate first. Try these tools to get authenticated:
1. `xano_auth_me` - Check auth status
2. `whoami` - Get user info
3. `hello name="TestUser"` - Basic greeting test

## Tools to Test (All 76 Must Be Tested)

### Core Infrastructure (Priority 1 - Test First)
1. **whoami** - Should show user info with Ultimate Format
2. **hello** name="TestUser" - Basic greeting  
3. **xano_auth_me** - Authentication status
4. **xano_list_instances** - List all Xano instances
5. **xano_list_databases** instance_name="xnwv-v1z6-dvnr" - List workspaces
6. **xano_list_tables** instance_name="xnwv-v1z6-dvnr" database_id="7" - List tables

### Database Operations (Priority 2)
7. **xano_get_instance_details** instance_name="xnwv-v1z6-dvnr"
8. **xano_get_workspace_details** instance_name="xnwv-v1z6-dvnr" workspace_id="7"
9. **xano_get_table_details** instance_name="xnwv-v1z6-dvnr" workspace_id="7" table_id="70"
10. **xano_get_table_schema** instance_name="xnwv-v1z6-dvnr" workspace_id="7" table_id="70"
11. **xano_browse_table_content** instance_name="xnwv-v1z6-dvnr" workspace_id="7" table_id="70"

### Table Management (Priority 3)
12. **xano_create_table** - Create new table
13. **xano_update_table** - Update table settings
14. **xano_delete_table** - Delete table
15. **xano_add_field_to_schema** - Add field to table
16. **xano_rename_schema_field** - Rename field
17. **xano_delete_field** - Delete field

### Record Operations (Priority 4)
18. **xano_get_table_record** - Get single record
19. **xano_create_table_record** - Create record
20. **xano_update_table_record** - Update record
21. **xano_delete_table_record** - Delete record
22. **xano_bulk_create_records** - Bulk create
23. **xano_bulk_update_records** - Bulk update

### Function Management (Priority 5)
24. **xano_list_functions** instance_name="xnwv-v1z6-dvnr" workspace_id="7"
25. **xano_create_function** - Create XanoScript function
26. **xano_get_function_details** - Get function details
27. **xano_update_function** - Update function
28. **xano_delete_function** - Delete function
29. **xano_publish_function** - Publish function to live

### API Management (Priority 6)
30. **xano_browse_api_groups** instance_name="xnwv-v1z6-dvnr" workspace_id="7"
31. **xano_create_api_group** - Create API group
32. **xano_get_api_group** - Get API group details
33. **xano_update_api_group** - Update API group
34. **xano_delete_api_group** - Delete API group
35. **xano_browse_apis_in_group** - List APIs in group
36. **xano_create_api** - Create API endpoint
37. **xano_get_api** - Get API details
38. **xano_update_api** - Update API
39. **xano_delete_api** - Delete API
40. **xano_create_api_with_logic** - Create API with XanoScript
41. **xano_get_api_with_logic** - Get API with logic
42. **xano_update_api_with_logic** - Update API logic
43. **xano_publish_api** - Publish API to live
44. **xano_list_apis_with_logic** - List APIs with logic

### Task Management (Priority 7)
45. **xano_create_task** - Create background task
46. **xano_list_tasks** instance_name="xnwv-v1z6-dvnr" workspace_id="7"
47. **xano_get_task_details** - Get task details
48. **xano_update_task** - Update task
49. **xano_delete_task** - Delete task
50. **xano_publish_task** - Publish task to live
51. **xano_activate_task** - Activate/deactivate task

### File & Export Operations (Priority 8)
52. **xano_list_files** instance_name="xnwv-v1z6-dvnr" workspace_id="7"
53. **xano_upload_file** - Upload file
54. **xano_delete_file** - Delete file
55. **xano_export_workspace** instance_name="xnwv-v1z6-dvnr" workspace_id="7"
56. **xano_export_workspace_schema** instance_name="xnwv-v1z6-dvnr" workspace_id="7"

### Branch Management (Priority 9)
57. **xano_list_workspace_branches** instance_name="xnwv-v1z6-dvnr" workspace_id="7"
58. **xano_delete_workspace_branch** - Delete branch

### Advanced Operations (Priority 10)
59. **xano_browse_request_history** instance_name="xnwv-v1z6-dvnr" workspace_id="7"
60. **xano_truncate_table** - Truncate table data
61. **xano_create_btree_index** - Create database index
62. **xano_create_search_index** - Create search index

### Schema & Script Tools (Priority 11)
63. **xano_create_table_with_script** - Create table with XanoScript
64. **xano_get_table_with_script** - Get table schema as script
65. **xano_update_table_with_script** - Update table with script

### XanoScript Development Tools (Priority 12)
66. **xano_get_function_template** function_name="db.query"
67. **xano_get_block_template** block_name="query"
68. **xano_get_started** - Get XanoScript setup guide
69. **xano_validate_line** line_of_script="var test { value = 1 }"

### Debug Tools (Priority 13)
70. **debug_auth** - Debug authentication
71. **debug_refresh_profile** - Refresh user profile
72. **debug_expire_oauth_tokens** - Expire tokens
73. **debug_kv_storage** - Examine KV storage
74. **debug_session_info** - Session information
75. **debug_list_active_sessions** - List active sessions
76. **debug_test_session_control** action="disable" sessionId="test123"

## Scoring System (BRUTAL - NO MERCY)

### Per-Tool Scoring (0-10 points)
- **10 points**: PERFECT Ultimate Format compliance
- **7-9 points**: Good format with minor issues  
- **4-6 points**: Partial compliance
- **1-3 points**: Poor formatting
- **0 points**: Complete failure or no Ultimate Format

### What Counts as FAILURE:
- Missing emoji header
- No separator line (50 equals signs)
- Plain JSON without Ultimate Format structure
- Inconsistent formatting
- Missing key metrics in header
- Authentication errors without proper formatting
- Any response that doesn't follow the specification EXACTLY

## Required Test Report Format

```markdown
# BRUTAL MCP TESTING RESULTS - THE TRUTH EXPOSED

## Executive Summary
- **Tools Tested**: X/76
- **Perfect Compliance**: X tools (10/10 score)
- **Partial Compliance**: X tools (4-9/10 score)  
- **Complete Failures**: X tools (0-3/10 score)
- **Overall Compliance Rate**: X%

## LIES EXPOSED
[List any false claims about compliance]

## Category Breakdown
### Database Operations: X/Y compliant
### Function Management: X/Y compliant
### API Management: X/Y compliant
[etc for all categories]

## WORST OFFENDERS (Score 0-3)
1. **[Tool Name]** - Score: X/10
   - Issue: [Specific compliance failure]
   - Expected: [What should have been returned]
   - Actual: [What was actually returned]

## BEST IMPLEMENTATIONS (Score 10/10)
1. **[Tool Name]** - Perfect Ultimate Format
   - Example response: [Show the perfect format]

## DETAILED RESULTS
[For each tool tested, provide:]
**Tool**: [name]
**Score**: X/10
**Status**: PASS/FAIL
**Issues**: [List specific problems]
**Response Sample**: ```[show actual response]```

## FINAL VERDICT
- **PASS**: ≥80% tools with score ≥7/10
- **FAIL**: <80% compliance

The developer's claim of "100% Ultimate Format compliance" is: **[TRUE/FALSE]**

## EVIDENCE
[Include actual response samples that prove compliance or failure]
```

## TESTING INSTRUCTIONS

1. **Start with authentication tools first** (whoami, hello, xano_auth_me)
2. **Test core database operations** to establish baseline
3. **Work through each category systematically**
4. **Document EVERY failure with exact response**
5. **Take screenshots/samples of both good and bad responses**
6. **Count EXACT compliance rates - no rounding up**
7. **Be RUTHLESS - even minor format issues count as failures**

## CRITICAL SUCCESS CRITERIA

For the developer's claim to be TRUE, you must find:
- **ALL 76 tools** have proper Ultimate Format responses
- **100% authentication errors** properly formatted
- **NO plain JSON responses** without Ultimate Format
- **Consistent emoji usage** across tool categories
- **Proper separator lines** (exactly 50 equals signs)

**ONE SINGLE TOOL without proper Ultimate Format = DEVELOPER IS LYING**

## Your Authority

You have FULL AUTHORITY to:
- Call out ANY formatting inconsistencies
- Expose ANY tools that don't meet specification
- Declare the developer a LIAR if claims don't match reality
- Demand PERFECT compliance, not "good enough"

**NO EXCUSES. NO "CLOSE ENOUGH". EITHER IT'S PERFECT OR IT'S A LIE.**

GO FORTH AND EXPOSE THE TRUTH!
