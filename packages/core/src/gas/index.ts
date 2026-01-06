import { createHandlerCore } from '../server/core.js';
import { GasPlatform } from '../platform/gas.js';
import { ServerConfig } from '../server/types.js';

export function createGasHandler(config: ServerConfig) {
  const platform = new GasPlatform();
  const coreHandler = createHandlerCore(config, platform);

  // The actual GAS trigger function
  return (e: GoogleAppsScript.Events.DoPost) => {
    // 1. Adapter: GAS Event -> ServerRequest
    const path = e.parameter.path || '';
    const request = {
      method: 'POST', // doPost is always POST
      url: path,
      path: path, // Kept for backwards compatibility
      headers: {
        // GAS doesn't give easy access to headers in all contexts,
        // so we often pass Auth via the body or specific params in GAS.
        // Fallback: Check body for special _auth property if header missing.
        Authorization: `Bearer ${e.parameter.auth || ''}`,
      },
      body:
        e.postData && e.postData.contents
          ? JSON.parse(e.postData.contents)
          : {},
    };

    // 2. Execution (Synchronous in GAS)
    // We must 'await' the core handler, but GAS runtimes handle promises poorly
    // at the top level. However, since we polyfilled 'fetch' to be synchronous-like
    // inside GasPlatform, this usually resolves immediately.
    // *Production Note:* In real GAS, you might need a sync wrapper loop.
    let result: any;

    // Hack for GAS Promise handling if needed:
    coreHandler(request)
      .then((r) => (result = r))
      .catch((err) => (result = { status: 500, body: err }));

    // Force wait (GAS-specific busy wait if async persists)
    const startTime = Date.now();
    while (!result && Date.now() - startTime < 5000) {
      // 5s timeout
      Utilities.sleep(100);
    }

    if (!result) {
      result = { status: 504, body: { error: 'Gateway Timeout' } };
    }

    // 3. Adapter: ServerResponse -> GAS ContentService
    const output = ContentService.createTextOutput(
      JSON.stringify(result?.body || {}),
    );
    output.setMimeType(ContentService.MimeType.JSON);
    return output;
  };
}
