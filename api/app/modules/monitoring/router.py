from fastapi import APIRouter, BackgroundTasks, Request, Response

from app.core import rate_limit
from app.core.errors import ProblemError
from app.core.settings import get_settings
from app.modules.monitoring import tunnel

router = APIRouter(prefix="/api/v1")

# A visitor's browser sends a handful of errors at most; this caps quota abuse.
REPORTS_PER_IP = rate_limit.Limit("sentry_tunnel_ip", max_hits=30, window_seconds=600)


@router.post("/monitoring/sentry", status_code=204)
async def browser_errors(request: Request, background: BackgroundTasks) -> Response:
    """Browser error reports (Sentry envelopes), forwarded after scrubbing; dropped when
    error reporting is off."""
    body = await request.body()
    if len(body) > tunnel.MAX_ENVELOPE_BYTES:
        raise ProblemError(413, "payload_too_large", "Zgłoszenie jest za duże")
    if get_settings().sentry_dsn is None:
        return Response(status_code=204)
    client_ip = request.client.host if request.client else "unknown"
    await rate_limit.hit(REPORTS_PER_IP, rate_limit.ip_subject(client_ip))
    events = tunnel.error_events(body)[:1]  # one error per report is all the SDK sends
    if events:
        background.add_task(tunnel.forward, events)
    return Response(status_code=204)
