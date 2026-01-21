from __future__ import annotations

import io
import json
import traceback
from contextlib import redirect_stdout

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("dexter-python")


@mcp.tool()
def python_eval(code: str) -> str:
    """Execute a small Python snippet and return stdout/result."""
    locals_dict: dict[str, object] = {}
    stdout = io.StringIO()

    try:
        with redirect_stdout(stdout):
            exec(code, {}, locals_dict)
    except Exception:
        return json.dumps(
            {
                "ok": False,
                "error": traceback.format_exc(limit=2),
            }
        )

    result = locals_dict.get("result")
    return json.dumps(
        {
            "ok": True,
            "stdout": stdout.getvalue(),
            "result": result,
        },
        default=str,
    )


if __name__ == "__main__":
    mcp.run()
