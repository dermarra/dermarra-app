"""Role-based admin access: permission checks on admin endpoints, the
role-assignment safeguards, role editing, and the activity log.

Runs against the shared dev DB like the rest of the suite (see conftest):
every user/role it creates is tagged __TEST__ and removed afterwards, and
it never changes a real account's access."""
import uuid

import pytest
from flask_jwt_extended import create_access_token

from app.extensions import db
from app.models.admin_role import AdminActivity, AdminRole
from app.models.user import User
from app.utils.permissions import has_permission


@pytest.fixture
def make_user(app):
    made = []

    def _make(role_key=None):
        role = AdminRole.query.filter_by(key=role_key).first() if role_key else None
        u = User(
            email=f"__test__-{uuid.uuid4().hex[:8]}@example.com",
            full_name="__TEST__ user",
            is_admin=role is not None,
            admin_role_id=role.id if role else None,
        )
        u.set_password("not-used-123")
        db.session.add(u)
        db.session.commit()
        made.append(u.id)
        return u

    yield _make
    db.session.rollback()
    AdminActivity.query.filter(AdminActivity.actor_id.in_(made)).delete(synchronize_session=False)
    User.query.filter(User.id.in_(made)).delete(synchronize_session=False)
    AdminRole.query.filter(AdminRole.name.like("__TEST__%")).delete(synchronize_session=False)
    db.session.commit()


def _auth(user):
    return {"Authorization": f"Bearer {create_access_token(identity=user.id)}"}


def test_role_limits_endpoints(app, make_user):
    client = app.test_client()
    dispatcher = make_user("orders_dispatch")
    h = _auth(dispatcher)

    assert client.get("/api/admin/orders", headers=h).status_code == 200
    assert client.get("/api/admin/inventory", headers=h).status_code == 200  # inventory.view
    r = client.post(f"/api/admin/orders/{uuid.uuid4()}/cancel", headers=h)
    assert r.status_code == 403 and r.get_json()["code"] == "forbidden"
    assert client.get("/api/admin/coupons", headers=h).status_code == 403
    assert client.post(f"/api/admin/inventory/{uuid.uuid4()}/adjust", headers=h, json={}).status_code == 403
    assert client.get("/api/admin/roles", headers=h).status_code == 403


def test_customer_and_anonymous_blocked(app, make_user):
    client = app.test_client()
    customer = make_user(None)
    assert client.get("/api/admin/dashboard", headers=_auth(customer)).status_code == 403
    assert client.get("/api/admin/dashboard").status_code == 401


def test_implied_and_super_permissions(app, make_user):
    dispatcher = make_user("orders_dispatch")
    sup = make_user("super_admin")
    assert has_permission(dispatcher, "orders.view")  # implied by orders.fulfil
    assert not has_permission(dispatcher, "orders.cancel")
    assert has_permission(sup, "roles.manage", "anything.else") and has_permission(sup, "activity.view")


def test_assigning_roles_and_safeguards(app, make_user):
    client = app.test_client()
    sup = make_user("super_admin")
    manager = make_user("store_manager")
    target = make_user(None)
    dispatch = AdminRole.query.filter_by(key="orders_dispatch").first()
    super_role = AdminRole.query.filter_by(is_super=True).first()

    # A store manager can't change anyone's access (no roles.manage).
    r = client.patch(f"/api/admin/users/{target.id}", headers=_auth(manager), json={"admin_role_id": dispatch.id})
    assert r.status_code == 403

    # A super admin can, and it's logged in plain English.
    r = client.patch(f"/api/admin/users/{target.id}", headers=_auth(sup), json={"admin_role_id": dispatch.id})
    assert r.status_code == 200 and r.get_json()["admin_role"]["key"] == "orders_dispatch"
    db.session.expire_all()
    assert User.query.get(target.id).is_admin is True
    log = AdminActivity.query.filter_by(actor_id=sup.id).order_by(AdminActivity.created_at.desc()).first()
    assert log and "Orders & dispatch" in log.summary and log.target_id == target.id

    # Nobody changes their own access.
    r = client.patch(f"/api/admin/users/{sup.id}", headers=_auth(sup), json={"admin_role_id": None})
    assert r.status_code == 400

    # roles.manage without being super can't hand out super admin.
    custom = AdminRole(name="__TEST__ access desk", key=f"__test__{uuid.uuid4().hex[:6]}", permissions=["roles.manage"])
    db.session.add(custom)
    db.session.commit()
    desk = make_user(None)
    desk.admin_role_id, desk.is_admin = custom.id, True
    db.session.commit()
    r = client.patch(f"/api/admin/users/{target.id}", headers=_auth(desk), json={"admin_role_id": super_role.id})
    assert r.status_code == 403

    # Removing access clears is_admin too.
    r = client.patch(f"/api/admin/users/{target.id}", headers=_auth(sup), json={"admin_role_id": None})
    assert r.status_code == 200
    db.session.expire_all()
    assert User.query.get(target.id).is_admin is False
    desk.admin_role_id, desk.is_admin = None, False
    db.session.commit()


def test_role_crud(app, make_user):
    client = app.test_client()
    h = _auth(make_user("super_admin"))
    super_role = AdminRole.query.filter_by(is_super=True).first()

    assert client.post("/api/admin/roles", headers=h, json={"name": "__TEST__ x", "permissions": []}).status_code == 400
    r = client.post("/api/admin/roles", headers=h, json={"name": "__TEST__ Packers", "permissions": ["orders.fulfil", "bogus"]})
    assert r.status_code == 201
    role = r.get_json()
    assert role["permissions"] == ["orders.fulfil"]  # unknown keys dropped
    assert client.post("/api/admin/roles", headers=h, json={"name": "__test__ packers", "permissions": ["orders.view"]}).status_code == 400

    r = client.patch(f"/api/admin/roles/{role['id']}", headers=h, json={"permissions": ["orders.view", "orders.fulfil"]})
    assert r.status_code == 200 and r.get_json()["permissions"] == ["orders.view", "orders.fulfil"]

    member = make_user(None)
    member.admin_role_id, member.is_admin = role["id"], True
    db.session.commit()
    assert client.delete(f"/api/admin/roles/{role['id']}", headers=h).status_code == 400  # in use
    member.admin_role_id, member.is_admin = None, False
    db.session.commit()
    assert client.delete(f"/api/admin/roles/{role['id']}", headers=h).status_code == 204

    assert client.patch(f"/api/admin/roles/{super_role.id}", headers=h, json={"name": "x"}).status_code == 400
    assert client.delete(f"/api/admin/roles/{super_role.id}", headers=h).status_code == 400


def test_activity_feed(app, make_user):
    client = app.test_client()
    sup = make_user("super_admin")
    h = _auth(sup)
    client.post("/api/admin/roles", headers=h, json={"name": "__TEST__ Feed", "permissions": ["dashboard.view"]})
    r = client.get(f"/api/admin/activity?actor={sup.id}", headers=h)
    assert r.status_code == 200
    items = r.get_json()["items"]
    assert items and items[0]["summary"] == "Created the __TEST__ Feed role" and items[0]["actor_name"] == "__TEST__ user"
    # GETs aren't logged; dispatchers can't read the log.
    assert all(i["method"] != "GET" for i in items)
    assert client.get("/api/admin/activity", headers=_auth(make_user("orders_dispatch"))).status_code == 403
