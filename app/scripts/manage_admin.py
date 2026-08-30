"""
CLI for managing Super Admin accounts.

Usage (run from the project root, with the venv active):
    python -m app.scripts.manage_admin create --email admin@mood9.com [--name "Super Admin"]
    python -m app.scripts.manage_admin reset-password --email admin@mood9.com
    python -m app.scripts.manage_admin list

If --password is omitted, you'll be prompted for it (hidden input, entered twice).
"""
import argparse
import getpass
import sys

from app.core.security import hash_password
from app.database.connection import SessionLocal
from app.models.super_admin import SuperAdmin


def _prompt_for_password() -> str:
    while True:
        pw1 = getpass.getpass("New password: ")
        pw2 = getpass.getpass("Confirm password: ")
        if not pw1:
            print("Password cannot be empty.")
            continue
        if pw1 != pw2:
            print("Passwords did not match, try again.")
            continue
        return pw1


def create_super_admin(email: str, password: str, name: str) -> None:
    db = SessionLocal()
    try:
        email = email.strip().lower()
        if db.query(SuperAdmin).filter(SuperAdmin.email == email).first():
            print(f"A super admin with email '{email}' already exists.")
            sys.exit(1)
        admin = SuperAdmin(name=name.strip(), email=email, password=hash_password(password))
        db.add(admin)
        db.commit()
        db.refresh(admin)
        print(f"Created super admin '{email}' (id={admin.id}).")
    finally:
        db.close()


def reset_password(email: str, password: str) -> None:
    db = SessionLocal()
    try:
        email = email.strip().lower()
        admin = db.query(SuperAdmin).filter(SuperAdmin.email == email).first()
        if not admin:
            print(f"No super admin found with email '{email}'.")
            sys.exit(1)
        admin.password = hash_password(password)
        db.commit()
        print(f"Password reset for '{email}'.")
    finally:
        db.close()


def list_super_admins() -> None:
    db = SessionLocal()
    try:
        admins = db.query(SuperAdmin).order_by(SuperAdmin.id.asc()).all()
        if not admins:
            print("No super admins found.")
            return
        for a in admins:
            print(f"id={a.id}  email={a.email}  name={a.name}  created_at={a.created_at}")
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Manage Super Admin accounts.")
    sub = parser.add_subparsers(dest="command", required=True)

    p_create = sub.add_parser("create", help="Create a new super admin.")
    p_create.add_argument("--email", required=True)
    p_create.add_argument("--password", help="If omitted, you'll be prompted (hidden input).")
    p_create.add_argument("--name", default="Super Admin")

    p_reset = sub.add_parser("reset-password", help="Reset an existing super admin's password.")
    p_reset.add_argument("--email", required=True)
    p_reset.add_argument("--password", help="If omitted, you'll be prompted (hidden input).")

    sub.add_parser("list", help="List existing super admins.")

    args = parser.parse_args()

    if args.command == "create":
        password = args.password or _prompt_for_password()
        create_super_admin(args.email, password, args.name)
    elif args.command == "reset-password":
        password = args.password or _prompt_for_password()
        reset_password(args.email, password)
    elif args.command == "list":
        list_super_admins()


if __name__ == "__main__":
    main()
