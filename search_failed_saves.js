// Search for failed save_api_key calls in request history

async function searchFailedSaves() {
  const workspace_id = 5;
  const api_id = 495; // save_api_key endpoint
  let page = 1;
  let hasMore = true;
  let failedRequests = [];
  
  while (hasMore && page <= 10) { // Check first 10 pages
    try {
      // Note: This is pseudocode - would need actual API call
      console.log(`Checking page ${page} for failed save_api_key requests...`);
      
      // In real implementation, would call the API and filter for:
      // - api_id = 495
      // - status \!= 200
      
      page++;
      // Set hasMore based on response
    } catch (error) {
      console.error('Error:', error);
      hasMore = false;
    }
  }
  
  return failedRequests;
}

console.log("This would search for failed save_api_key calls");
console.log("Need to use the Xano tool to actually query the request history");
