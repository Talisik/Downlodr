# Download Error Codes Explained

This document explains the various error codes that can occur during downloads and what they mean for troubleshooting.

## 📊 Error Code Categories

### ✅ Success Codes
- **0**: Success - Download completed successfully

### 🔒 System Permission Errors (1-50)
- **1**: Permission Denied - Operation not permitted, insufficient permissions
- **13**: Access Denied - Permission denied, insufficient access rights
- **21**: Directory Error - Target is a directory, not a file
- **28**: **Disk Full** - No space left on device (⚠️ High Severity)
- **36**: Filename Too Long - File name exceeds maximum length
- **63**: Name Too Long - File name too long for filesystem

### 📁 File System Errors
- **2**: File Not Found - No such file or directory
- **22**: Invalid Argument - Invalid argument passed to system call
- **35**: Resource Busy - Resource temporarily unavailable
- **38**: Function Not Implemented - Function not implemented in current system
- **267**: Invalid Directory - Directory name is invalid

### 🌐 Network Errors (50-200)
- **6**: Device Error - No such device or address
- **32**: Broken Pipe - Connection broken by remote end
- **54**: Connection Reset - Connection reset by peer
- **60**: Operation Timeout - Operation timed out
- **61**: Connection Refused - Connection refused by remote server
- **99**: Address In Use - Cannot assign requested address
- **101**: Network Unreachable - Network is unreachable
- **104**: Connection Reset - Connection reset by peer
- **110**: Connection Timeout - Connection timed out
- **111**: Connection Refused - Connection refused by remote host

### 🖥️ Windows-Specific Errors (10000+)
- **10051**: Network Unreachable (Windows) - Network is unreachable
- **10053**: Connection Aborted (Windows) - Connection aborted by remote host
- **10054**: Connection Reset (Windows) - Connection reset by remote host
- **11000**: Request Timeout - Request timed out
- **11001**: Host Not Found - Host not found in DNS
- **11002**: Host Not Found - Host not found in DNS resolution
- **11003**: Non-recoverable Error - Non-recoverable network error
- **11004**: No Data Record - Valid name, no data record of requested type
- **11005**: No Route to Host - No route to host

### 🔍 DNS Errors (Negative Codes)
- **-2**: DNS Resolution Failed - Name or service not known
- **-3**: DNS Temporary Failure - Temporary failure in name resolution

### 🌐 HTTP Error Codes (300-500)
- **302**: Temporary Redirect - Resource temporarily moved
- **400**: Bad Request - Server cannot process malformed request
- **401**: Unauthorized - Authentication required
- **403**: Forbidden - Access denied to resource
- **404**: Not Found - Resource not found on server
- **405**: Method Not Allowed - HTTP method not supported
- **406**: Not Acceptable - Server cannot provide requested format
- **410**: Gone - Resource permanently removed
- **429**: Too Many Requests - Rate limit exceeded
- **451**: Unavailable For Legal Reasons - Content blocked due to legal restrictions
- **500**: Internal Server Error - Server encountered an error
- **503**: Service Unavailable - Server temporarily unavailable

### 🔒 HTTPS/SSL Errors (Connection Security)
- **HTTPS_POOL_TIMEOUT**: HTTPS connection pool timed out while reading data
- **HTTPS_POOL_ERROR**: HTTPS connection pool encountered an error
- **SSL_HANDSHAKE_ERROR**: SSL/TLS handshake failed during HTTPS connection
- **SSL_CERTIFICATE_ERROR**: SSL certificate verification failed

### 📺 YouTube/Platform Errors
- **YOUTUBE_FORMAT_UNAVAILABLE**: Network was unable to retrieve format information

## 🎯 Common Error Scenarios and Solutions

### 💾 Storage Issues
**Error 28 - Disk Full**
- **Cause**: No space left on device
- **Solutions**:
  - Free up disk space
  - Choose a different download location
  - Check available storage

### 🔐 Permission Issues
**Errors 1, 13 - Permission Denied**
- **Cause**: Insufficient permissions to write files
- **Solutions**:
  - Check file/folder permissions
  - Run as administrator if needed
  - Verify write access to destination folder

### 🌐 Network Issues
**Errors 54, 60, 61, 110, 111 - Connection Problems**
- **Cause**: Network connectivity or server issues
- **Solutions**:
  - Check internet connection
  - Verify network settings
  - Try using different network
  - Retry the download

### 🔍 DNS Issues
**Errors -2, -3, 11001, 11002 - Domain Resolution**
- **Cause**: Cannot resolve domain name to IP address
- **Solutions**:
  - Check internet connection
  - Verify URL is correct
  - Try different DNS server
  - Wait and retry for temporary failures

### 🌐 HTTP Issues
**Errors 403, 404, 429, 451 - Server-side Problems**
- **Cause**: Server refuses request or content unavailable
- **Solutions**:
  - Verify content still exists
  - Check account permissions
  - Wait before retrying (for rate limits)
  - Try alternative sources

### 🔒 HTTPS/SSL Issues
**HTTPS_POOL_TIMEOUT, HTTPS_POOL_ERROR - Connection Pool Problems**
- **Cause**: HTTPS connection pool issues, often during high-volume downloads
- **Solutions**:
  - Check network stability and speed
  - Retry the download with slower connection
  - Try downloading at a different time
  - Consider using a VPN if connection is throttled

**SSL_HANDSHAKE_ERROR, SSL_CERTIFICATE_ERROR - Security Issues**
- **Cause**: SSL/TLS connection security problems
- **Solutions**:
  - Check system date and time
  - Update system certificates
  - Try different network or VPN
  - Disable antivirus/firewall temporarily for testing

### 📺 YouTube/Platform Issues
**YOUTUBE_FORMAT_UNAVAILABLE - Format Retrieval Problems**
- **Cause**: Network unable to retrieve format information from YouTube
- **Solutions**:
  - Try again in a few moments
  - Network may be temporarily unable to retrieve format data
  - Check internet connection stability
  - Try using different quality settings

## 🔄 Retry Recommendations

### ✅ Safe to Retry (Temporary Issues)
- Network timeouts (60, 110)
- Connection resets (32, 54, 104)
- DNS temporary failures (-3)
- Resource busy (35)
- Rate limits (429)
- Server errors (500, 503)
- HTTPS connection pool errors (HTTPS_POOL_TIMEOUT, HTTPS_POOL_ERROR)
- SSL/TLS handshake issues (SSL_HANDSHAKE_ERROR, SSL_CERTIFICATE_ERROR)
- YouTube format retrieval issues (YOUTUBE_FORMAT_UNAVAILABLE)

### ⚠️ May Retry After Action
- Permission errors (1, 13) - after fixing permissions
- Disk full (28) - after freeing space
- Filename too long (36, 63) - after shortening name

### ❌ Don't Retry (Permanent Issues)
- Content not found (404)
- Access forbidden (403)
- Content removed (410)
- Legal restrictions (451)
- Function not implemented (38)

## 🎨 Error Severity Levels

### 🟢 **Low Severity** (Usually Temporary)
- Success codes
- Temporary redirects (302)
- Automatic recovery possible

### 🟡 **Medium Severity** (User Action Needed)
- Network connection issues
- DNS resolution problems
- File system issues
- Server errors

### 🔴 **High Severity** (Serious Problems)
- Disk full (28)
- Permission denied (1, 13)
- Network unreachable (101, 10051)
- Non-recoverable errors (11003)
- Legal restrictions (451)

## 📚 Technical References

The error codes are based on:
- **System Error Codes**: Standard POSIX/Unix error codes
- **Windows Error Codes**: Windows-specific networking errors
- **HTTP Status Codes**: Standard web server response codes
- **ytdlp Errors**: YouTube-dl and yt-dlp specific error conditions

## 🛠️ Troubleshooting Tips

1. **Check the Error Category**: Determines the type of problem
2. **Review Suggestions**: Each error provides specific recommendations
3. **Check Retry Status**: Some errors are worth retrying, others aren't
4. **Monitor Severity**: High severity errors need immediate attention
5. **Look at Error Context**: The full error message provides additional clues

---

*This error code system helps provide better user feedback and enables more effective troubleshooting of download issues.* 