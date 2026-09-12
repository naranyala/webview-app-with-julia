#!/usr/bin/env julia
# Seed Chain Notes with real brainstorming essays as persistent data.
# Reads frontend-preact/seed/chain-essays.json, skips titles that already
# exist, and creates the rest through Backend.handle_request so validation,
# UUIDs, timestamps, and atomic Persistence.save! are all exercised.
# Usage: julia --project=. scripts/seed_chain_notes.jl [--reset]

using WebViewApp
using WebViewApp.Backend
using JSON3

function serialize_qna(question, answer)
    "Question:\n$(strip(question))\n\nAnswer:\n$(strip(answer))"
end

function main()
    reset = "--reset" in ARGS
    # Ensure persisted state is loaded (Backend.__init__ runs on module load,
    # but call explicitly for script contexts).
    try
        Backend.__init__()
    catch err
        @warn "Backend init note" exception = err
    end

    seed_path = joinpath(@__DIR__, "..", "frontend-preact", "seed", "chain-essays.json")
    isfile(seed_path) || error("seed file missing: $seed_path")
    seeds = JSON3.read(read(seed_path, String))

    if reset
        for note in copy(Backend.STATE.notes)
            Backend.handle_request("deleteNote", JSON3.write([note["id"]]))
        end
        println("reset: cleared $(length(seeds)) seed slots")
    end

    status, payload = Backend.handle_request("getNotes", "")
    existing = status == 0 ? Set(n["title"] for n in JSON3.read(payload)) : Set()
    created = 0
    skipped = 0
    for seed in seeds
        title = String(seed["title"])
        if title in existing
            skipped += 1
            continue
        end
        body = serialize_qna(String(seed["question"]), String(seed["answer"]))
        tag = String(seed["tag"])
        st, res = Backend.handle_request("createNote", JSON3.write([title, tag, body]))
        if st == 0
            created += 1
            println("seeded: $title")
        else
            println("FAILED: $title -> $res")
        end
    end

    status, payload = Backend.handle_request("getNotes", "")
    total = status == 0 ? length(JSON3.read(payload)) : -1
    println("done: created=$created skipped=$skipped total_notes=$total")
    println("store: $(Backend.NOTES_FILE)")
end

main()
