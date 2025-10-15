import os
import sys
from pathlib import Path

import pytest
from langchain_core.messages import AIMessage

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

os.environ.setdefault("OPENAI_API_KEY", "test-key")

from dexter import agent as agent_module  # noqa: E402
from dexter.agent import Agent  # noqa: E402
from dexter.schemas import Answer, IsDone, Task, TaskList  # noqa: E402


@pytest.fixture
def capture_execution(monkeypatch):
    captured = {}

    def fake_execute(self, tool, tool_name, inp_args):
        captured["tool_name"] = tool_name
        captured["args"] = inp_args
        return [{"symbol": "AAPL", "qty": "100"}]

    monkeypatch.setattr(agent_module.Agent, "_execute_tool", fake_execute)
    return captured


def test_agent_executes_position_tool(monkeypatch, capture_execution):
    def fake_call_llm(prompt, system_prompt=None, output_schema=None, tools=None):
        if output_schema is TaskList:
            return TaskList(tasks=[Task(id=1, description="Retrieve positions", done=False)])
        if tools is not None:
            return AIMessage(
                content="",
                additional_kwargs={
                    "tool_calls": [
                        {
                            "id": "call_1",
                            "type": "function",
                            "function": {"name": "get_alpaca_positions", "arguments": "{}"},
                        }
                    ]
                },
            )
        if output_schema is IsDone:
            return IsDone(done=True)
        raise AssertionError("Unexpected call_llm invocation")

    def fake_generate(self, query, session_outputs):
        assert session_outputs
        assert "get_alpaca_positions" in session_outputs[0]
        assert "AAPL" in str(session_outputs[0])
        return "Positions summarised"

    monkeypatch.setattr(agent_module, "call_llm", fake_call_llm)
    monkeypatch.setattr(agent_module.Agent, "_generate_answer", fake_generate)

    agent = Agent(max_steps=5, max_steps_per_task=3)
    final_answer = agent.run("show me my positions")

    assert capture_execution["tool_name"] == "get_alpaca_positions"
    assert capture_execution["args"] == {}
    assert final_answer == "Positions summarised"


def test_agent_fallback_tool(monkeypatch, capture_execution):
    def fake_call_llm(prompt, system_prompt=None, output_schema=None, tools=None):
        if output_schema is TaskList:
            return TaskList(tasks=[Task(id=1, description="Retrieve account info", done=False)])
        if tools is not None:
            return AIMessage(content="")  # no tool calls
        if output_schema is IsDone:
            return IsDone(done=True)
        raise AssertionError("Unexpected call_llm invocation")

    def fake_generate(self, query, session_outputs):
        assert any("get_alpaca_account" in entry for entry in session_outputs)
        return "Account summarised"

    monkeypatch.setattr(agent_module, "call_llm", fake_call_llm)
    monkeypatch.setattr(agent_module.Agent, "_generate_answer", fake_generate)

    agent = Agent(max_steps=5, max_steps_per_task=3)
    final_answer = agent.run("show account info")

    assert capture_execution["tool_name"] == "get_alpaca_account"
    assert capture_execution["args"] == {}
    assert final_answer == "Account summarised"
