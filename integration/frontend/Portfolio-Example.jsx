/**
 * Example: How to integrate FundamentalAnalysis into your Portfolio page
 *
 * This shows the exact integration pattern for your Laserbeam Capital dashboard
 */

import React, { useState, useEffect } from 'react';
import FundamentalAnalysis from './FundamentalAnalysis';
import './Portfolio.css';

function Portfolio() {
  const [portfolioData, setPortfolioData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch portfolio data (your existing logic)
  useEffect(() => {
    fetchPortfolioData();
  }, []);

  const fetchPortfolioData = async () => {
    try {
      const response = await fetch('https://api.laserbeamcapital.com/api/portfolio');
      const data = await response.json();
      setPortfolioData(data);
    } catch (error) {
      console.error('Error fetching portfolio:', error);
    } finally {
      setLoading(false);
    }
  };

  // Extract tickers from portfolio positions
  const portfolioTickers = portfolioData?.positions
    ?.map(position => position.ticker)
    .filter(ticker => ticker && ticker !== 'CASH') || [];

  if (loading) {
    return <div className="loading">Loading portfolio...</div>;
  }

  return (
    <div className="portfolio-page">
      {/* EXISTING PORTFOLIO SECTION */}
      <header className="portfolio-header">
        <h1>PORTFOLIO</h1>
        <div className="date">Jan 14</div>
      </header>

      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="card">
          <div className="card-label">FUM</div>
          <div className="card-value">
            ${(portfolioData?.fum / 1000000).toFixed(1)}M
          </div>
        </div>
        <div className="card">
          <div className="card-label">DAILY P&L</div>
          <div className="card-value negative">
            {portfolioData?.dailyPnL}
          </div>
        </div>
        <div className="card">
          <div className="card-label">DAILY CHANGE</div>
          <div className="card-value">
            {portfolioData?.dailyChange}%
          </div>
        </div>
        <div className="card">
          <div className="card-label">POSITIONS</div>
          <div className="card-value">
            {portfolioData?.positionCount}
          </div>
        </div>
      </div>

      {/* Portfolio Table */}
      <div className="portfolio-table-container">
        <table className="portfolio-table">
          <thead>
            <tr>
              <th>NAME</th>
              <th>TICKER</th>
              <th>% AUM</th>
              <th>PRICE</th>
              <th>DAY%</th>
              <th>MTD%</th>
              <th>VALUE</th>
              <th>P&L</th>
              <th>MKT CAP</th>
              <th>P/E</th>
              <th>EPS GR</th>
              <th>EARNINGS</th>
            </tr>
          </thead>
          <tbody>
            {portfolioData?.positions?.map((position) => (
              <tr key={position.ticker}>
                <td>{position.name}</td>
                <td>
                  <span className="ticker-badge">
                    {position.ticker}
                    <span className={`change ${position.dayChangeClass}`}>
                      {position.dayChange}
                    </span>
                  </span>
                </td>
                <td>{position.aumPercent}%</td>
                <td>${position.price}</td>
                <td className={position.dayPercent >= 0 ? 'positive' : 'negative'}>
                  {position.dayPercent > 0 ? '+' : ''}{position.dayPercent}%
                </td>
                <td className={position.mtdPercent >= 0 ? 'positive' : 'negative'}>
                  {position.mtdPercent > 0 ? '+' : ''}{position.mtdPercent}%
                </td>
                <td>${position.value}</td>
                <td className={position.pnl >= 0 ? 'positive' : 'negative'}>
                  ${position.pnl}
                </td>
                <td>${position.marketCap}</td>
                <td>{position.pe}</td>
                <td className={position.epsGrowth >= 0 ? 'positive' : 'negative'}>
                  {position.epsGrowth > 0 ? '+' : ''}{position.epsGrowth}%
                </td>
                <td>{position.earningsDate || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/*
        NEW: FUNDAMENTAL ANALYSIS SECTION
        Add this after your portfolio table
      */}
      <section className="fundamental-analysis-section">
        <FundamentalAnalysis portfolioTickers={portfolioTickers} />
      </section>
    </div>
  );
}

export default Portfolio;

/**
 * Add this CSS to your Portfolio.css or create a new stylesheet:
 */

/*
.fundamental-analysis-section {
  margin-top: 48px;
  padding-top: 48px;
  border-top: 2px solid #2a2a2a;
}

@media (max-width: 768px) {
  .fundamental-analysis-section {
    margin-top: 32px;
    padding-top: 32px;
  }
}
*/
