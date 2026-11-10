from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel

from scripts.check_contract import compare

CONTRACT: dict[str, Any] = {
    "paths": {
        "/api/v1/things": {
            "post": {
                "requestBody": {
                    "content": {"application/json": {"schema": {"$ref": "#/components/schemas/In"}}}
                },
                "responses": {
                    "201": {
                        "content": {
                            "application/json": {"schema": {"$ref": "#/components/schemas/Out"}}
                        }
                    }
                },
            }
        },
        "/api/v1/planned": {"get": {"responses": {"200": {"description": "later"}}}},
    },
    "components": {
        "schemas": {
            "In": {"type": "object", "properties": {"name": {"type": "string"}}},
            "Out": {
                "allOf": [
                    {"type": "object", "properties": {"id": {"type": "string"}}},
                    {"type": "object", "properties": {"name": {"type": "string"}}},
                ]
            },
        }
    },
}


class In(BaseModel):
    name: str


class Out(BaseModel):
    id: str
    name: str


class OutWithExtra(Out):
    secret: str


def spec(response_model: type[BaseModel] = Out, path: str = "/api/v1/things") -> dict[str, Any]:
    app = FastAPI()

    @app.post(path, status_code=201, response_model=response_model)
    async def create(payload: In) -> Any:
        return {}

    return app.openapi()


def test_matching_api_has_no_differences_and_planned_paths_are_allowed() -> None:
    assert compare(spec(), CONTRACT) == []


def test_extra_response_field_is_reported() -> None:
    errors = compare(spec(response_model=OutWithExtra), CONTRACT)
    assert errors == ["POST /api/v1/things 201 response: fields not in contract: secret"]


def test_undocumented_path_is_reported() -> None:
    assert compare(spec(path="/api/v1/other"), CONTRACT) == ["/api/v1/other: path not in contract"]


def test_missing_contract_field_and_wrong_method_are_reported() -> None:
    contract = {**CONTRACT, "paths": {"/api/v1/things": {"put": {}}}}
    assert compare(spec(), contract) == ["POST /api/v1/things: method not in contract"]

    class Partial(BaseModel):
        id: str

    errors = compare(spec(response_model=Partial), CONTRACT)
    assert errors == ["POST /api/v1/things 201 response: contract fields missing in code: name"]


def test_undocumented_success_status_is_reported() -> None:
    contract: dict[str, Any] = {
        **CONTRACT,
        "paths": {"/api/v1/things": {"post": {"responses": {"200": {}}}}},
    }
    assert compare(spec(), contract) == [
        "POST /api/v1/things request: contract does not declare fields (name)",
        "POST /api/v1/things 201: response status not in contract",
    ]


NESTED_CONTRACT: dict[str, Any] = {
    "paths": {
        "/api/v1/session": {
            "post": {
                "responses": {
                    "200": {
                        "content": {
                            "application/json": {"schema": {"$ref": "#/components/schemas/Session"}}
                        }
                    }
                }
            }
        },
        "/api/v1/items": {
            "get": {
                "responses": {
                    "200": {
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "items": {
                                            "type": "array",
                                            "items": {"$ref": "#/components/schemas/Account"},
                                        }
                                    },
                                }
                            }
                        }
                    }
                }
            }
        },
        "/health": {
            "get": {
                "responses": {
                    "200": {
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {"status": {"const": "ok"}},
                                }
                            }
                        }
                    }
                }
            }
        },
    },
    "components": {
        "schemas": {
            "Account": {"type": "object", "properties": {"id": {"type": "string"}}},
            "Session": {
                "type": "object",
                "properties": {
                    "accessToken": {"type": "string"},
                    "account": {
                        "oneOf": [{"$ref": "#/components/schemas/Account"}, {"type": "null"}]
                    },
                },
            },
        }
    },
}


class Account(BaseModel):
    id: str


class LeakyAccount(Account):
    passwordHash: str


class Session(BaseModel):
    accessToken: str
    account: LeakyAccount | None


class Page(BaseModel):
    items: list[LeakyAccount]


def nested_spec(health_untyped: bool = False) -> dict[str, Any]:
    app = FastAPI()

    @app.post("/api/v1/session")
    async def session() -> Session:
        return Session(accessToken="t", account=None)

    @app.get("/api/v1/items")
    async def items() -> Page:
        return Page(items=[])

    if health_untyped:

        @app.get("/health")
        async def health() -> dict[str, str]:
            return {"status": "ok"}

    return app.openapi()


def test_extra_field_in_nested_object_and_array_items_is_reported() -> None:
    assert compare(nested_spec(), NESTED_CONTRACT) == [
        "POST /api/v1/session 200 response.account: fields not in contract: passwordHash",
        "GET /api/v1/items 200 response.items[]: fields not in contract: passwordHash",
    ]


def test_untyped_response_against_contract_object_is_reported() -> None:
    errors = compare(nested_spec(health_untyped=True), NESTED_CONTRACT)
    assert "GET /health 200 response: code does not declare fields (status)" in errors
