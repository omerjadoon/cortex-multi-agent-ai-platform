"""LangGraph StateGraph wiring all agent nodes into a RAG + code-gen pipeline."""

from langgraph.graph import StateGraph, END

from backend.agents.state import AgentState
from backend.agents.nodes.guardrail import guardrail_check
from backend.agents.nodes.router import route_intent
from backend.agents.nodes.rag import run_rag
from backend.agents.nodes.planner import plan_code
from backend.agents.nodes.codegen import generate_code
from backend.agents.nodes.validator import validate_code
from backend.agents.nodes.testgen import generate_tests
from backend.agents.nodes.testrunner import run_tests
from backend.agents.nodes.fixer import fix_code


def _after_guardrail(state: AgentState) -> str:
    """Route after guardrail check: terminate if blocked by security error, else continue to router."""
    if state.get("error") and "BLOCKED" in str(state.get("progress_events", [])):
        return END
    if any(ev.get("step") == "guardrail" and ev.get("status") == "failed" for ev in state.get("progress_events", [])):
        return END
    return "router"


def _after_validation(state: AgentState) -> str:
    """Route after validation: fix if errors (within retry budget), else generate tests."""
    if state.get("validation_errors"):
        if state.get("retry_count", 0) < state.get("max_retries", 3):
            return "fixer"
        return END
    return "testgen"


def _after_tests(state: AgentState) -> str:
    """Route after test run: end if passing or retry budget exhausted, else fix."""
    events = state.get("progress_events", [])
    for ev in reversed(events):
        if ev.get("step") == "testrun":
            if ev.get("status") == "done":
                return END
            break

    if state.get("retry_count", 0) >= state.get("max_retries", 3):
        return END
    return "fixer"


def _after_planner(state: AgentState) -> str:
    """Route after planning: if human clarification is needed, pause and terminate execution."""
    if state.get("needs_clarification"):
        return END
    return "codegen"


def build_graph() -> StateGraph:
    """Construct and compile the LangGraph StateGraph."""
    g = StateGraph(AgentState)

    # Register nodes
    g.add_node("guardrail", guardrail_check)
    g.add_node("router", route_intent)
    g.add_node("rag", run_rag)
    g.add_node("planner", plan_code)
    g.add_node("codegen", generate_code)
    g.add_node("validator", validate_code)
    g.add_node("testgen", generate_tests)
    g.add_node("testrunner", run_tests)
    g.add_node("fixer", fix_code)

    # Entry point is guardrail input check
    g.set_entry_point("guardrail")

    # Guardrail -> Router or END (if blocked)
    g.add_conditional_edges(
        "guardrail",
        _after_guardrail,
        {
            "router": "router",
            END: END,
        },
    )

    # Router -> RAG or Planner
    g.add_conditional_edges(
        "router",
        lambda s: s.get("intent", "rag"),
        {
            "rag": "rag",
            "codegen": "planner",
        },
    )

    # RAG terminates
    g.add_edge("rag", END)

    # Code-gen pipeline: planner -> (clarification ? END : codegen)
    g.add_conditional_edges(
        "planner",
        _after_planner,
        {"codegen": "codegen", END: END},
    )
    g.add_edge("codegen", "validator")

    # After validation: fix | testgen | end
    g.add_conditional_edges(
        "validator",
        _after_validation,
        {"fixer": "fixer", "testgen": "testgen", END: END},
    )

    g.add_edge("testgen", "testrunner")

    # After test run: fix | end
    g.add_conditional_edges(
        "testrunner",
        _after_tests,
        {"fixer": "fixer", END: END},
    )

    # Fixer loops back to codegen for another attempt
    g.add_edge("fixer", "codegen")

    return g.compile()


# Module-level compiled graph — import this for use in API handlers
graph = build_graph()
