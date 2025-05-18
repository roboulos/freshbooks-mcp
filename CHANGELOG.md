# Changelog

All notable changes to this project will be documented in this file.

## [1.3.0] - 2024-05-18

### Major Improvements

1. **Standardized Response Format**
   - Implemented a consistent structure with `success`, `data`, `message`, and `operation` fields
   - Made error responses follow the same pattern with standardized error objects
   - Eliminated inconsistency across different tool responses

2. **Proper API Response Handling**
   - Fixed critical issues with interpreting non-standard API responses (like empty arrays or null values)
   - Added robust handling for bulk operations with their unique response formats
   - Improved status code interpretation for various operations (particularly DELETEs)

3. **Enhanced Schema Operations**
   - Fixed schema field operations to properly maintain field order
   - Improved field deletion and renaming operations to handle API responses correctly
   - Better validation for schema-related parameters

4. **Bulk Operations Support**
   - Complete rewrite of bulk creation and update functionality
   - Added proper format conversion between client and API expectations
   - Implemented response transformation to provide useful update statistics

5. **Error Handling and Reporting**
   - More descriptive error messages with relevant context
   - Proper error classification with appropriate error codes
   - Distinction between API errors, validation errors, and exceptions

### Specific Fixes

1. **Schema Manipulation Fix**
   - Fixed `xano_add_field_to_schema` tool that was causing errors when adding fields
   - Simplified implementation to match the Python SDK approach
   - Added better handling of schema responses

2. **API Endpoint Path Fixes**
   - Fixed several record operations using incorrect paths (`/row` instead of `/content`)
   - Updated all endpoints to use the correct Xano API paths

3. **Error Handling for Null Responses**
   - Improved handling of DELETE operations that return null/empty responses (successful operations)
   - Added special handling for Xano's bulk operation response format

4. **Response Format Standardization**
   - Standardized all tool responses with consistent format
   - Added proper error classification with appropriate codes
   - Added operation context to all responses

5. **Bulk Operations Fixes**
   - Fixed `xano_bulk_create_records` to use correct parameter name (`items` instead of `records`)
   - Fixed `xano_bulk_update_records` endpoint and request method
   - Added detection for partial success scenarios in bulk operations

### Tool Enhancements

1. **Added Tool Annotations**
   - Added MCP tool annotations (readOnlyHint, destructiveHint, idempotentHint, openWorldHint)
   - Improved tool descriptions and parameter documentation

2. **Parameter Validation**
   - Enhanced validation for all tool parameters
   - Added better error messages for invalid parameters

3. **Response Cleanup**
   - Standardized success and error responses across all tools
   - Added operation identifiers to all responses

## [1.2.0] - 2023-06-04

### Added
- Added `xano_create_table_record` tool for creating individual records
- Added `xano_update_table_record` tool for updating individual records
- Added `xano_delete_table_record` tool for deleting individual records
- Added `xano_bulk_create_records` tool for creating multiple records in a single operation
- Added `xano_bulk_update_records` tool for updating multiple records in a single operation
- Added comprehensive logging to all API tools for better debugging

### Fixed
- Fixed `xano_add_field_to_schema` tool to correctly handle API response formats
- Fixed endpoint paths for record operations (using `/content` instead of `/row`)
- Fixed error handling in `xano_delete_table_record` and `xano_update_table` for null responses
- Fixed issues with empty schema handling in schema manipulation tools
- Enhanced error checking to prevent crashes when API returns unexpected formats

### Changed
- Simplified `xano_add_field_to_schema` implementation to match Python SDK pattern
- Improved error handling for all API operations
- Enhanced `makeApiRequest` function to better handle different response types
- Updated documentation to reflect new tools and improvements
- Removed problematic `xano_search_table_content` tool that was causing Claude to crash

## [1.1.0] - 2023-05-15

### Added
- Implemented Xano OAuth authentication flow
- Added persistent token storage with KV
- Created custom login UI for authentication
- Added API key extraction from auth/me response
- Implemented 16 initial Xano API tools for database management
- Added debug tools for OAuth flow troubleshooting

### Fixed
- Resolved client ID mismatch errors in OAuth flow
- Fixed cookie-based authentication persistence
- Improved error handling in API requests

### Changed
- Restructured project to use OAuthProvider pattern
- Enhanced authentication flow with client approval
- Updated documentation with comprehensive usage instructions

## [1.0.0] - 2023-04-20

### Added
- Initial release with basic MCP server implementation
- Simple token-based authentication
- Basic Xano API integration
- Documentation for deployment and usage