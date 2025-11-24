clean:
	rm -rf dist build __pycache__ *.egg-info

format:
	poetry run ruff format src tests

lint:
	poetry run ruff format --check --diff src tests
	poetry run ruff check src tests
	poetry run mypy src

publish: clean
	poetry build
	poetry publish

test-publish: clean
	poetry build
	poetry publish -r testpypi

tests:
	poetry run pytest

tests-parallel:
	poetry run pytest -n auto

unit-tests:
	poetry run pytest -m "not integration" --doctest-modules

int-tests:
	poetry run pytest -m integration

update-localnet:
	./bin/localnet.sh update

start-localnet:
	./bin/localnet.sh up

stop-localnet:
	./bin/localnet.sh down

serve:
	mkdocs serve

.PHONY: $(MAKECMDGOALS)
