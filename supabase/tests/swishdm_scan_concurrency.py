"""Run only against a disposable PostgreSQL database with the migration applied."""
import concurrent.futures
import json
import os
import subprocess
import uuid

assert os.environ.get("SWISHDM_INTAKE_TEST_DB") == "1", "refusing non-test database"
prefix = "concurrency-" + uuid.uuid4().hex[:12]


def sql(statement):
    result = subprocess.run(
        ["psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-d", "postgres", "-c", statement],
        check=True, capture_output=True, text=True,
    )
    return result.stdout.strip()


def admit(i):
    body = {
        "brand": "Concurrency test", "brand_url": f"https://{prefix}-{i}.example/",
        "rival": "Rival", "rival_url": None, "product": "Shoes", "name": "Tester",
        "email": "test@example.com", "linkedin_url": None, "source": "form",
    }
    return sql("select public.swishdm_scan_request_admit('" + json.dumps(body) + "'::jsonb)")


try:
    with concurrent.futures.ThreadPoolExecutor(max_workers=30) as pool:
        answers = list(pool.map(admit, range(30)))
    assert answers.count("accepted") == 15, answers
    assert answers.count("full") == 15, answers
    assert sql(f"select count(*) from public.swishdm_scan_requests where brand_domain like '{prefix}-%'") == "15"
    print("30 concurrent admissions: 15 accepted, 15 full")
finally:
    sql(f"delete from public.swishdm_scan_requests where brand_domain like '{prefix}-%'")
