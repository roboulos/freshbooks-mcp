# Changelog

All notable changes to this project will be documented in this file.

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