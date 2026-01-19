/**
 * Fundamental Analysis Component for Laserbeam Capital
 *
 * Place this file in: laserbeam/src/components/FundamentalAnalysis.jsx
 *
 * This component provides ticker input and displays hedge fund analyst reports
 * with Buy/Hold/Sell recommendations.
 */

import React, { useState } from 'react';
import axios from 'axios';
import './FundamentalAnalysis.css';

const FundamentalAnalysis = ({ portfolioTickers = [] }) => {
  const [ticker, setTicker] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [selectedMode, setSelectedMode] = useState('auto');

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.laserbeamcapital.com';

  /**
   * Handle ticker analysis
   */
  const handleAnalyze = async (tickerToAnalyze) => {
    if (!tickerToAnalyze || tickerToAnalyze.trim() === '') {
      setError('Please enter a valid ticker symbol');
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/fundamental-analysis/analyze`,
        {
          ticker: tickerToAnalyze.toUpperCase(),
          mode: selectedMode === 'auto' ? null : selectedMode,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      setAnalysis(response.data);
    } catch (err) {
      console.error('Analysis error:', err);
      setError(
        err.response?.data?.message ||
        'Failed to analyze ticker. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle form submission
   */
  const handleSubmit = (e) => {
    e.preventDefault();
    handleAnalyze(ticker);
  };

  /**
   * Handle portfolio ticker click
   */
  const handlePortfolioTickerClick = (portfolioTicker) => {
    setTicker(portfolioTicker);
    handleAnalyze(portfolioTicker);
  };

  /**
   * Get recommendation badge color
   */
  const getRecommendationColor = (action) => {
    switch (action) {
      case 'BUY':
        return '#10b981'; // green
      case 'SELL':
        return '#ef4444'; // red
      case 'HOLD':
        return '#f59e0b'; // amber
      default:
        return '#6b7280'; // gray
    }
  };

  /**
   * Get confidence level label
   */
  const getConfidenceLabel = (confidence) => {
    if (confidence >= 80) return 'High Confidence';
    if (confidence >= 60) return 'Medium Confidence';
    return 'Low Confidence';
  };

  /**
   * Format currency
   */
  const formatCurrency = (value) => {
    if (!value) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  /**
   * Format percentage
   */
  const formatPercentage = (value) => {
    if (value === null || value === undefined) return 'N/A';
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  return (
    <div className="fundamental-analysis">
      {/* Header Section */}
      <div className="analysis-header">
        <h2>Fundamental Analysis</h2>
        <p>AI-powered equity research using hedge fund analyst methodology</p>
      </div>

      {/* Ticker Input Section */}
      <div className="ticker-input-section">
        <form onSubmit={handleSubmit} className="ticker-form">
          <div className="input-group">
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="Enter ticker (e.g., AAPL, GOOGL, MSFT)"
              className="ticker-input"
              disabled={loading}
            />
            <select
              value={selectedMode}
              onChange={(e) => setSelectedMode(e.target.value)}
              className="mode-select"
              disabled={loading}
            >
              <option value="auto">Auto Mode</option>
              <option value="deep-dive">Deep Dive</option>
              <option value="preview">Earnings Preview</option>
              <option value="review">Earnings Review</option>
            </select>
            <button
              type="submit"
              className="analyze-button"
              disabled={loading || !ticker.trim()}
            >
              {loading ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>
        </form>

        {/* Portfolio Tickers Quick Access */}
        {portfolioTickers.length > 0 && (
          <div className="portfolio-tickers">
            <span className="portfolio-label">Analyze portfolio holdings:</span>
            <div className="ticker-chips">
              {portfolioTickers.slice(0, 10).map((portfolioTicker) => (
                <button
                  key={portfolioTicker}
                  className="ticker-chip"
                  onClick={() => handlePortfolioTickerClick(portfolioTicker)}
                  disabled={loading}
                >
                  {portfolioTicker}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Analyzing {ticker}... This may take 15-30 seconds.</p>
          <p className="loading-subtext">
            Gathering financial data, news, and generating analysis...
          </p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <h3>Analysis Error</h3>
          <p>{error}</p>
          <button onClick={() => setError(null)} className="dismiss-button">
            Dismiss
          </button>
        </div>
      )}

      {/* Analysis Results */}
      {analysis && !loading && (
        <div className="analysis-results">
          {/* Company Header */}
          <div className="company-header">
            <div className="company-info">
              <h1 className="company-ticker">{analysis.ticker}</h1>
              <h2 className="company-name">{analysis.company}</h2>
              <span className="analysis-mode-badge">{analysis.mode}</span>
            </div>
            <div className="analysis-meta">
              <span className="timestamp">
                {new Date(analysis.timestamp).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Recommendation Card */}
          <div
            className="recommendation-card"
            style={{ borderColor: getRecommendationColor(analysis.recommendation.action) }}
          >
            <div className="recommendation-header">
              <div className="recommendation-action">
                <span
                  className="action-badge"
                  style={{ backgroundColor: getRecommendationColor(analysis.recommendation.action) }}
                >
                  {analysis.recommendation.action}
                </span>
                <span className="confidence-badge">
                  {getConfidenceLabel(analysis.recommendation.confidence)}
                  <span className="confidence-value">
                    {analysis.recommendation.confidence}%
                  </span>
                </span>
              </div>

              <div className="recommendation-metrics">
                <div className="metric">
                  <span className="metric-label">Target Price</span>
                  <span className="metric-value">
                    {formatCurrency(analysis.recommendation.targetPrice)}
                  </span>
                </div>
                <div className="metric">
                  <span className="metric-label">Upside</span>
                  <span
                    className="metric-value"
                    style={{
                      color: analysis.recommendation.upside >= 0 ? '#10b981' : '#ef4444',
                    }}
                  >
                    {formatPercentage(analysis.recommendation.upside)}
                  </span>
                </div>
                <div className="metric">
                  <span className="metric-label">Time Horizon</span>
                  <span className="metric-value">
                    {analysis.recommendation.timeHorizon || 'Medium'}
                  </span>
                </div>
              </div>
            </div>

            <div className="recommendation-reasoning">
              <h4>Investment Thesis</h4>
              <p>{analysis.recommendation.reasoning}</p>
            </div>

            {analysis.recommendation.keyRisks && (
              <div className="key-risks">
                <h4>Key Risks</h4>
                <ul>
                  {analysis.recommendation.keyRisks.map((risk, index) => (
                    <li key={index}>{risk}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Analysis Content */}
          <div className="analysis-content">
            <div className="analysis-text">
              {/* Render markdown-like content */}
              {analysis.analysis.fullText.split('\n\n').map((paragraph, index) => {
                // Check if it's a header
                if (paragraph.startsWith('##')) {
                  const headerText = paragraph.replace(/^##\s*/, '');
                  return (
                    <h3 key={index} className="section-header">
                      {headerText}
                    </h3>
                  );
                }

                // Check if it's a list
                if (paragraph.includes('\n- ')) {
                  const items = paragraph.split('\n').filter(line => line.startsWith('- '));
                  return (
                    <ul key={index} className="analysis-list">
                      {items.map((item, i) => (
                        <li key={i}>{item.replace(/^- /, '')}</li>
                      ))}
                    </ul>
                  );
                }

                // Regular paragraph
                return paragraph.trim() ? (
                  <p key={index} className="analysis-paragraph">
                    {paragraph}
                  </p>
                ) : null;
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="action-buttons">
            <button
              onClick={() => handleAnalyze(ticker)}
              className="refresh-button"
            >
              🔄 Refresh Analysis
            </button>
            <button
              onClick={() => {
                setAnalysis(null);
                setTicker('');
              }}
              className="clear-button"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Initial State */}
      {!analysis && !loading && !error && (
        <div className="initial-state">
          <div className="initial-icon">📊</div>
          <h3>Ready to Analyze</h3>
          <p>
            Enter a ticker symbol above to get a comprehensive fundamental analysis
            with Buy/Hold/Sell recommendation.
          </p>
          <div className="feature-list">
            <div className="feature-item">
              <span className="feature-icon">🎯</span>
              <span>AI-Powered Analysis</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">📈</span>
              <span>Real-time Financial Data</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🔍</span>
              <span>Hedge Fund Methodology</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">💡</span>
              <span>Clear Recommendations</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FundamentalAnalysis;
