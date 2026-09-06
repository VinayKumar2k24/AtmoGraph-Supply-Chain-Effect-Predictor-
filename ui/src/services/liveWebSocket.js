/**
 * AtmoGraph — Live WebSocket Service
 * Week 4: Real-Time Event Streaming Client
 *
 * Connects to ws://${window.location.hostname}:8000/ws/live (or VITE_WS_URL)
 * Handles:
 *  - Single shared connection for the whole application
 *  - Auto-connect on app load & auto-reconnect on disconnect
 *  - Event handling: worker_status, live_news_processed, error, pong
 *  - Deduplication of incoming events
 *  - Detailed [LiveWS] logging
 *  - Listener subscriptions for React components
 */

function getWsUrl() {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  const host =
    typeof window !== 'undefined' && window.location && window.location.hostname
      ? window.location.hostname
      : 'localhost';
  return `ws://${host}:8000/ws/live`;
}

export const WS_URL = getWsUrl();

/**
 * Safely derives authoritative extracted entity count from event or article payload.
 * Rule: Extracted = actual number of NLP entities extracted by backend.
 */
export function getExtractedCount(item) {
  if (!item) return 0;

  // 1. Authoritative numeric fields directly on item
  if (typeof item.extracted_entities === 'number' && !isNaN(item.extracted_entities)) {
    return item.extracted_entities;
  }
  if (typeof item.total_entities === 'number' && !isNaN(item.total_entities)) {
    return item.total_entities;
  }
  if (typeof item.extracted_count === 'number' && !isNaN(item.extracted_count)) {
    return item.extracted_count;
  }

  // 2. If extracted_entities is an array of entity objects
  if (Array.isArray(item.extracted_entities)) {
    return item.extracted_entities.length;
  }

  // 3. Inspect embedded article payload if present
  if (item.article && typeof item.article === 'object') {
    if (typeof item.article.extracted_entities === 'number' && !isNaN(item.article.extracted_entities)) {
      return item.article.extracted_entities;
    }
    if (typeof item.article.total_entities === 'number' && !isNaN(item.article.total_entities)) {
      return item.article.total_entities;
    }
    if (typeof item.article.extracted_count === 'number' && !isNaN(item.article.extracted_count)) {
      return item.article.extracted_count;
    }
    if (Array.isArray(item.article.extracted_entities)) {
      return item.article.extracted_entities.length;
    }
    if (Array.isArray(item.article.entities)) {
      return item.article.entities.length;
    }
  }

  // 4. Fallback to entities array length
  if (Array.isArray(item.entities)) {
    return item.entities.length;
  }

  return 0;
}

/**
 * Safely derives authoritative matched entity count from event or article payload.
 * Rule: Matched = actual number of entities successfully matched by EntityMatcher.
 * Crucial: Never uses shock_origin as matched count.
 */
export function getMatchedCount(item) {
  if (!item) return 0;

  // 1. Authoritative numeric fields directly on item (authoritative backend count)
  if (typeof item.matched_entities === 'number' && !isNaN(item.matched_entities)) {
    return item.matched_entities;
  }
  if (typeof item.matched_count === 'number' && !isNaN(item.matched_count)) {
    return item.matched_count;
  }

  // 2. Array of matched entities
  if (Array.isArray(item.matched_entities)) {
    const matchedOnly = item.matched_entities.filter(
      (m) => m && (m.matched === true || m.status === 'matched')
    );
    return matchedOnly.length > 0 ? matchedOnly.length : item.matched_entities.length;
  }

  // 3. matched_entity_details array
  if (Array.isArray(item.matched_entity_details)) {
    const matchedOnly = item.matched_entity_details.filter(
      (m) => m && (m.matched === true || m.status === 'matched')
    );
    return matchedOnly.length > 0 ? matchedOnly.length : item.matched_entity_details.length;
  }

  // 4. Embedded article object
  if (item.article && typeof item.article === 'object') {
    if (typeof item.article.matched_entities === 'number' && !isNaN(item.article.matched_entities)) {
      return item.article.matched_entities;
    }
    if (typeof item.article.matched_count === 'number' && !isNaN(item.article.matched_count)) {
      return item.article.matched_count;
    }
    if (Array.isArray(item.article.matched_entities)) {
      const matchedOnly = item.article.matched_entities.filter(
        (m) => m && (m.matched === true || m.status === 'matched')
      );
      return matchedOnly.length > 0 ? matchedOnly.length : item.article.matched_entities.length;
    }
    if (Array.isArray(item.article.entities)) {
      return item.article.entities.filter(
        (e) => e && (e.matched === true || e.status === 'matched')
      ).length;
    }
  }

  // 5. Entities array filter
  if (Array.isArray(item.entities)) {
    return item.entities.filter(
      (e) => e && (e.matched === true || e.status === 'matched')
    ).length;
  }

  return 0;
}

/**
 * Normalizes a live WebSocket event into a complete article object preserving
 * all entity information, NLP counts, and metadata.
 */
export function normalizeLiveArticle(data) {
  if (!data) return null;

  const articleObj = data.article && typeof data.article === 'object' ? data.article : {};
  const extractedCount = getExtractedCount(data);
  const matchedCount = getMatchedCount(data);

  // Entities array resolution: prioritize real extracted entities
  let entities = [];
  if (Array.isArray(articleObj.entities) && articleObj.entities.length > 0) {
    entities = articleObj.entities;
  } else if (Array.isArray(data.entities) && data.entities.length > 0) {
    entities = data.entities;
  } else if (Array.isArray(data.matched_entity_details) && data.matched_entity_details.length > 0) {
    entities = data.matched_entity_details;
  } else if (
    Array.isArray(data.matched_entities) &&
    data.matched_entities.length > 0 &&
    typeof data.matched_entities[0] === 'object'
  ) {
    entities = data.matched_entities;
  } else if (
    Array.isArray(articleObj.matched_entities) &&
    articleObj.matched_entities.length > 0 &&
    typeof articleObj.matched_entities[0] === 'object'
  ) {
    entities = articleObj.matched_entities;
  } else if (
    Array.isArray(data.extracted_entities) &&
    data.extracted_entities.length > 0 &&
    typeof data.extracted_entities[0] === 'object'
  ) {
    entities = data.extracted_entities;
  }

  const riskLevel =
    articleObj.risk_level ||
    data.risk_level ||
    ((data.affected_nodes || 0) > 3 ? 'HIGH' : (data.avg_predicted_delay || 0) > 5 ? 'HIGH' : 'MEDIUM');

  return {
    ...articleObj,
    id: data.article_id || articleObj.id || `LIVE_${Date.now()}`,
    title: data.title || articleObj.title || 'Untitled Disruption Event',
    source: data.source || articleObj.source || 'Live Feed',
    published_at: data.published_at || articleObj.published_at || data.timestamp || new Date().toISOString(),
    text:
      articleObj.text ||
      data.text ||
      `Live real-time disruption shock detected at ${data.shock_origin || 'Unknown'}. GNN predicted delay: ${data.avg_predicted_delay ?? 0} days across ${data.affected_nodes ?? 0} affected supply chain node(s).`,
    shock_origin: data.shock_origin || articleObj.shock_origin || 'None',
    risk_level: riskLevel,
    total_entities: extractedCount,
    extracted_entities: extractedCount,
    extracted_count: extractedCount,
    matched_count: matchedCount,
    matched_entities: matchedCount,
    candidate_count: articleObj.candidate_count ?? extractedCount,
    is_live: true,
    neo4j_updated: data.neo4j_updated ?? articleObj.neo4j_updated ?? true,
    gnn_updated: data.gnn_updated ?? articleObj.gnn_updated ?? true,
    ripple_updated: data.ripple_updated ?? articleObj.ripple_updated ?? true,
    avg_predicted_delay: data.avg_predicted_delay ?? articleObj.avg_predicted_delay ?? 0.0,
    affected_nodes: data.affected_nodes ?? articleObj.affected_nodes ?? 0,
    max_depth: data.max_depth ?? articleObj.max_depth ?? 0,
    duration_ms: data.duration_ms ?? articleObj.duration_ms ?? 0,
    entities: entities,
    raw_event: data,
  };
}

class LiveWebSocketService {
  constructor() {
    this.ws = null;
    this.url = WS_URL;
    // Status can be: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED'
    this.status = 'DISCONNECTED';
    this.listeners = new Set();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 50;
    this.reconnectTimeout = null;
    this.pingInterval = null;
    this.processedEventKeys = new Set();
    this.latestEvent = null;
    this.latestProcessedEvent = null;
    this.workerStatus = null; // { status: 'processing'|'completed'|'error', ... }
    this.liveArticles = []; // Accumulator for live news articles
    this.isExplicitlyClosed = false;
    this.isConnecting = false;
  }

  /**
   * Connect to WebSocket server.
   * Safe to call multiple times; will not create duplicate connections.
   */
  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    if (this.isConnecting) {
      return;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.isConnecting = true;
    this.isExplicitlyClosed = false;
    this._updateStatus('CONNECTING');
    console.log('[LiveWS] Connecting... to', this.url);

    try {
      if (this.ws) {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;
        try { this.ws.close(); } catch (_) {}
      }

      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.isConnecting = false;
        console.log('[LiveWS] Connected');
        this.reconnectAttempts = 0;
        this._updateStatus('CONNECTED');
        this._startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this._handleMessage(data);
        } catch (err) {
          console.warn('[LiveWS] Could not parse message:', event.data, err);
        }
      };

      this.ws.onerror = (err) => {
        this.isConnecting = false;
        console.warn('[LiveWS] WebSocket error occurred:', err);
      };

      this.ws.onclose = (event) => {
        this.isConnecting = false;
        console.log('[LiveWS] Disconnected:', event.code, event.reason);
        this._stopHeartbeat();
        this._updateStatus('DISCONNECTED');

        if (!this.isExplicitlyClosed) {
          this._scheduleReconnect();
        }
      };
    } catch (err) {
      this.isConnecting = false;
      console.error('[LiveWS] Failed to initialize WebSocket:', err);
      this._updateStatus('DISCONNECTED');
      this._scheduleReconnect();
    }
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping' }));
        } catch {
          // ignore
        }
      }
    }, 25000);
  }

  _stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  _scheduleReconnect() {
    if (this.isExplicitlyClosed) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[LiveWS] Max reconnect attempts reached.');
      this._updateStatus('DISCONNECTED');
      return;
    }

    this.reconnectAttempts++;
    this._updateStatus('CONNECTING');
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 8000);
    console.log(`[LiveWS] Reconnecting... in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts})`);

    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  _updateStatus(newStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this._notifyListeners({ type: 'connection_status_change', status: newStatus });
    }
  }

  _handleMessage(data) {
    if (!data || typeof data !== 'object') return;

    // Filter out internal keepalive pongs
    if (data.type === 'pong') return;

    // Deduplication key: prevents processing exact duplicate frame
    const eventKey = `${data.type}_${data.article_id || ''}_${data.status || ''}_${data.timestamp || ''}`;
    if (this.processedEventKeys.has(eventKey)) {
      return;
    }
    this.processedEventKeys.add(eventKey);
    if (this.processedEventKeys.size > 300) {
      const first = this.processedEventKeys.values().next().value;
      this.processedEventKeys.delete(first);
    }

    this.latestEvent = data;

    // ── 1. worker_status ───────────────────────────────────────────────────
    if (data.type === 'worker_status') {
      console.log('[LiveWS] Message received: worker_status');
      this.workerStatus = {
        status: data.status, // 'processing' | 'completed' | 'error'
        article_id: data.article_id,
        title: data.title || (data.article_id ? `Article ${data.article_id}` : ''),
        error: data.error,
        timestamp: data.timestamp || new Date().toISOString(),
      };
    }

    // ── 2. live_news_processed ─────────────────────────────────────────────
    else if (data.type === 'live_news_processed') {
      console.log('[LiveNews] Raw live_news_processed event:', data);
      console.log('[LiveNews] Extracted entities:', data.extracted_entities ?? data.article?.extracted_entities);
      console.log('[LiveNews] Matched entities:', data.matched_entities ?? data.article?.matched_entities);
      console.log('[LiveWS] Message received: live_news_processed');
      console.log(`[LiveWS] Live news processed: ${data.title}`);
      console.log(`[LiveWS] Shock origin: ${data.shock_origin}`);

      this.latestProcessedEvent = data;

      // Also set workerStatus completed if not already set
      this.workerStatus = {
        status: 'completed',
        article_id: data.article_id,
        title: data.title,
        timestamp: data.timestamp || new Date().toISOString(),
      };

      // Add complete normalized live news article to live news list
      const newArticle = normalizeLiveArticle(data);

      // Ensure no duplicate in live articles
      const filtered = this.liveArticles.filter((a) => a.id !== newArticle.id);
      this.liveArticles = [newArticle, ...filtered];
    }

    // ── 3. error event ─────────────────────────────────────────────────────
    else if (data.type === 'error') {
      console.warn('[LiveWS] Error event received:', data.error || data.message);
      this.workerStatus = {
        status: 'error',
        error: data.error || data.message || 'WebSocket Error',
        timestamp: data.timestamp || new Date().toISOString(),
      };
    }

    this._notifyListeners(data);
  }

  _notifyListeners(event) {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((callback) => {
      try {
        callback(event, snapshot);
      } catch (err) {
        console.error('[LiveWS] Error in listener callback:', err);
      }
    });
  }

  getSnapshot() {
    return {
      connectionStatus: this.status,
      workerStatus: this.workerStatus,
      latestProcessedEvent: this.latestProcessedEvent,
      liveNewsArticles: [...this.liveArticles],
      latestEvent: this.latestEvent,
    };
  }

  /**
   * Subscribe to live events and state changes.
   * @param {Function} callback (event, snapshot) => void
   * @returns {Function} unsubscribe function
   */
  subscribe(callback) {
    this.listeners.add(callback);

    // Provide initial state immediately
    try {
      callback({ type: 'initial_state' }, this.getSnapshot());
    } catch (err) {
      console.error('[LiveWS] Initial subscriber notification error:', err);
    }

    // Auto-connect on first subscriber
    if (this.status === 'DISCONNECTED' && !this.ws) {
      this.connect();
    }

    return () => {
      this.listeners.delete(callback);
    };
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(typeof message === 'string' ? message : JSON.stringify(message));
    }
  }

  disconnect() {
    this.isExplicitlyClosed = true;
    this.isConnecting = false;
    this._stopHeartbeat();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      try { this.ws.close(); } catch (_) {}
      this.ws = null;
    }
    this._updateStatus('DISCONNECTED');
  }

  getStatus() {
    return this.status;
  }
}

// Global Singleton Export
export const liveWebSocket = new LiveWebSocketService();
