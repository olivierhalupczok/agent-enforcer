"""Load the seed guardrails into Supabase.

Run from apps/api once the guardrails migrations are applied:

    uv run python -m app.seed_db --email demo@guardrail.local

It signs in as that user (the password is asked for; locally it is in supabase/.env.demo) and
inserts the seed guardrails. Ids that already exist are skipped, so it is safe to run again and
never overwrites edits made through the panel.
"""

import argparse
import getpass

from app.core.config import settings
from app.core.supabase import get_supabase_for_user
from app.guardrails.repository import TABLE, to_row
from app.seeds import seed_guardrails
from supabase import Client, create_client


def seed_guardrails_table(client: Client) -> int:
    rows = [to_row(g) for g in seed_guardrails()]
    client.table(TABLE).upsert(rows, on_conflict="id", ignore_duplicates=True).execute()
    return len(rows)


def sign_in(email: str, password: str) -> Client:
    if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
        raise SystemExit("Set SUPABASE_URL and SUPABASE_KEY in apps/api/.env first.")
    auth = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY).auth
    session = auth.sign_in_with_password({"email": email, "password": password}).session
    if session is None:
        raise SystemExit("Sign-in failed.")
    return get_supabase_for_user(session.access_token)


def main() -> None:
    parser = argparse.ArgumentParser(description="Load the seed guardrails into Supabase.")
    parser.add_argument("--email", required=True, help="a Supabase user to sign in as")
    parser.add_argument("--password", help="asked for if not given")
    args = parser.parse_args()
    password = args.password or getpass.getpass(f"Password for {args.email}: ")

    count = seed_guardrails_table(sign_in(args.email, password))
    print(f"Seeded {count} guardrails (existing ids skipped).")


if __name__ == "__main__":
    main()
