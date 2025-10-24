import shutil
from datetime import datetime
from typing import Optional
import plotext as plt


def get_optimal_chart_size() -> tuple[int, int]:
    """
    Calculate optimal chart dimensions based on terminal size.
    
    Returns:
        tuple: (width, height) for the chart
    """
    terminal_size = shutil.get_terminal_size()
    width = min(terminal_size.columns - 4, 120)  # Leave some padding
    height = min(terminal_size.lines // 3, 20)   # Use ~1/3 of terminal height
    return width, height


def format_timestamp_labels(timestamps: list[int], max_labels: int = 7) -> tuple[list[int], list[str]]:
    """
    Format timestamp labels for chart X-axis.
    
    Args:
        timestamps: List of Unix timestamps in milliseconds
        max_labels: Maximum number of labels to show
    
    Returns:
        tuple: (positions, labels) for X-axis
    """
    if not timestamps:
        return [], []
    
    if len(timestamps) == 1:
        # Handle single timestamp
        dt = datetime.fromtimestamp(timestamps[0] / 1000)
        return [0], [dt.strftime("%m/%d")]
    
    try:
        # Sample timestamps evenly
        step = max(1, len(timestamps) // max_labels)
        sampled_indices = list(range(0, len(timestamps), step))
        
        # Ensure we include the last timestamp
        if len(sampled_indices) > 0 and sampled_indices[-1] != len(timestamps) - 1:
            sampled_indices.append(len(timestamps) - 1)
        
        positions = []
        labels = []
        
        for idx in sampled_indices:
            if idx < len(timestamps):
                positions.append(idx)
                timestamp_ms = timestamps[idx]
                dt = datetime.fromtimestamp(timestamp_ms / 1000)
                
                # Format based on time range
                time_range = timestamps[-1] - timestamps[0]
                days = time_range / (1000 * 60 * 60 * 24)
                
                if days <= 1:  # Less than a day, show time
                    labels.append(dt.strftime("%H:%M"))
                elif days <= 30:  # Less than a month, show month/day
                    labels.append(dt.strftime("%m/%d"))
                else:  # Longer periods, show month
                    labels.append(dt.strftime("%b %d"))
        
        return positions, labels
    except Exception as e:
        # Fallback to simple numeric labels if formatting fails
        print(f"Warning: Timestamp formatting failed: {e}")
        num_labels = min(max_labels, len(timestamps))
        step = max(1, len(timestamps) // num_labels)
        positions = list(range(0, len(timestamps), step))
        labels = [str(i) for i in positions]
        return positions, labels


def render_candlestick_chart(
    ohlc_data: dict,
    title: Optional[str] = None,
    width: Optional[int] = None,
    height: Optional[int] = None
) -> None:
    """
    Render an OHLC candlestick chart in the terminal.
    
    Args:
        ohlc_data: Dictionary with 'candles' list containing OHLC data
                   Each candle should have: timestamp, open, high, low, close
        title: Optional chart title
        width: Optional chart width (auto-detected if not provided)
        height: Optional chart height (auto-detected if not provided)
    """
    try:
        candles = ohlc_data.get("candles", [])
        if not candles:
            print("No OHLC data to display")
            return
        
        # Extract data - handle both dict and list formats
        # CoinGecko API returns arrays: [timestamp, open, high, low, close]
        if isinstance(candles[0], dict):
            # Dictionary format (from formatted_data)
            timestamps = [c["timestamp"] for c in candles]
            opens = [c["open"] for c in candles]
            highs = [c["high"] for c in candles]
            lows = [c["low"] for c in candles]
            closes = [c["close"] for c in candles]
        else:
            # List format (raw API data)
            timestamps = [c[0] for c in candles]
            opens = [c[1] for c in candles]
            highs = [c[2] for c in candles]
            lows = [c[3] for c in candles]
            closes = [c[4] for c in candles]
    except (KeyError, IndexError, TypeError) as e:
        print(f"Error extracting candle data: {e}")
        print(f"First candle type: {type(candles[0])}, value: {candles[0]}")
        raise
        
        # Get chart dimensions
        if width is None or height is None:
            auto_width, auto_height = get_optimal_chart_size()
            width = width or auto_width
            height = height or auto_height
        
        # Clear previous plot
        plt.clear_figure()
        
        # Set plot size
        plt.plot_size(width, height)
        
        # Format X-axis labels
        positions, labels = format_timestamp_labels(timestamps)
        
        # Create custom candlestick visualization using basic plot elements
        # plotext.candlestick() has bugs, so we build our own
        x_indices = list(range(len(candles)))
        
        # Determine color for each candle (green=up, red=down)
        for i in x_indices:
            color = "green+" if closes[i] >= opens[i] else "red+"
            
            # Draw high-low line (wick)
            plt.plot([i, i], [lows[i], highs[i]], color=color, marker="")
            
            # Draw open-close body (use thicker representation)
            # Create a small vertical bar by plotting multiple close points
            body_top = max(opens[i], closes[i])
            body_bottom = min(opens[i], closes[i])
            body_mid = (body_top + body_bottom) / 2
            
            # Plot body as scatter points for thickness
            plt.scatter([i], [body_mid], marker="hd", color=color)
        
        # Apply custom X-axis labels (after the loop!)
        if positions and labels:
            plt.xticks(positions, labels)
        
        # Set title
        if title:
            plt.title(title)
        else:
            coin_id = str(ohlc_data.get("id", "Crypto"))
            days = str(ohlc_data.get("days", ""))
            if coin_id:
                plt.title(f"{coin_id.upper()} - {days} Day OHLC")
            else:
                plt.title("OHLC Chart")
        
        # Set labels
        vs_currency = str(ohlc_data.get("vs_currency", "USD")).upper()
        plt.xlabel("Date")
        plt.ylabel(f"Price ({vs_currency})")
        
        # Set theme
        plt.theme("pro")
        
        # Show the plot
        plt.show()
        print()  # Add spacing after chart
        
        # Force flush to ensure chart appears immediately
        import sys
        sys.stdout.flush()
    
    except Exception as e:
        print(f"Chart rendering error: {e}")
        import traceback
        traceback.print_exc()
        import sys
        sys.stdout.flush()


def render_line_chart(
    price_data: list[dict],
    title: Optional[str] = None,
    vs_currency: str = "USD",
    width: Optional[int] = None,
    height: Optional[int] = None
) -> None:
    """
    Render a line chart for price trends in the terminal.
    
    Args:
        price_data: List of dictionaries with 'timestamp' and 'price' keys
        title: Optional chart title
        vs_currency: Currency for Y-axis label
        width: Optional chart width (auto-detected if not provided)
        height: Optional chart height (auto-detected if not provided)
    """
    if not price_data:
        print("No price data to display")
        return
    
    # Extract data
    timestamps = [p["timestamp"] for p in price_data]
    prices = [p["price"] for p in price_data]
    
    # Get chart dimensions
    if width is None or height is None:
        auto_width, auto_height = get_optimal_chart_size()
        width = width or auto_width
        height = height or auto_height
    
    # Clear previous plot
    plt.clear_figure()
    
    # Set plot size
    plt.plot_size(width, height)
    
    # Create line chart
    plt.plot(prices, color="cyan", marker="braille")
    
    # Format X-axis labels
    positions, labels = format_timestamp_labels(timestamps)
    plt.xticks(positions, labels)
    
    # Set title and labels
    if title:
        plt.title(title)
    else:
        plt.title("Price Chart")
    
    plt.xlabel("Date")
    plt.ylabel(f"Price ({vs_currency.upper()})")
    
    # Set theme
    plt.theme("pro")
    
    # Show the plot
    plt.show()
    print()  # Add spacing after chart
    
    # Force flush to ensure chart appears immediately
    import sys
    sys.stdout.flush()


def render_volume_chart(
    volume_data: list[dict],
    title: Optional[str] = None,
    vs_currency: str = "USD",
    width: Optional[int] = None,
    height: Optional[int] = None
) -> None:
    """
    Render a bar chart for trading volume in the terminal.
    
    Args:
        volume_data: List of dictionaries with 'timestamp' and 'volume' keys
        title: Optional chart title
        vs_currency: Currency for Y-axis label
        width: Optional chart width (auto-detected if not provided)
        height: Optional chart height (auto-detected if not provided)
    """
    if not volume_data:
        print("No volume data to display")
        return
    
    # Extract data
    timestamps = [v["timestamp"] for v in volume_data]
    volumes = [v["volume"] for v in volume_data]
    
    # Get chart dimensions
    if width is None or height is None:
        auto_width, auto_height = get_optimal_chart_size()
        width = width or auto_width
        height = height or auto_height
    
    # Clear previous plot
    plt.clear_figure()
    
    # Set plot size
    plt.plot_size(width, height)
    
    # Create bar chart
    plt.bar(volumes, color="blue")
    
    # Format X-axis labels
    positions, labels = format_timestamp_labels(timestamps)
    plt.xticks(positions, labels)
    
    # Set title and labels
    if title:
        plt.title(title)
    else:
        plt.title("Trading Volume")
    
    plt.xlabel("Date")
    plt.ylabel(f"Volume ({vs_currency.upper()})")
    
    # Set theme
    plt.theme("pro")
    
    # Show the plot
    plt.show()
    print()  # Add spacing after chart

