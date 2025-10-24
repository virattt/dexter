#!/usr/bin/env python3
"""
Simple plotext test to verify terminal chart rendering works.
"""

import plotext as plt

print("=" * 80)
print("Simple Plotext Test")
print("=" * 80)

# Test 1: Simple line plot
print("\nTest 1: Simple line plot")
print("-" * 80)
plt.clear_figure()
plt.plot([1, 2, 3, 4, 5], [1, 4, 9, 16, 25])
plt.title("Simple Line Plot - y = x²")
plt.xlabel("X")
plt.ylabel("Y")
plt.show()
print("✓ Line plot displayed above")

# Test 2: Bar chart
print("\nTest 2: Bar chart")
print("-" * 80)
plt.clear_figure()
plt.bar(["A", "B", "C", "D"], [10, 20, 15, 25])
plt.title("Simple Bar Chart")
plt.show()
print("✓ Bar chart displayed above")

# Test 3: Scatter plot with colors
print("\nTest 3: Scatter plot")
print("-" * 80)
plt.clear_figure()
plt.scatter([1, 2, 3, 4, 5], [2, 4, 3, 5, 4], marker="hd", color="green+")
plt.title("Scatter Plot")
plt.show()
print("✓ Scatter plot displayed above")

print("\n" + "=" * 80)
print("If you see ASCII charts above, plotext is working!")
print("If not, there may be a terminal compatibility issue.")
print("=" * 80)

