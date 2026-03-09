#!/bin/bash
# Collabstr scraper watchdog — monitors PID, auto-restarts from checkpoint on death
# Milestones reported to /tmp/collabstr-milestone.log

SCRIPT_DIR="/home/podhi/.openclaw/workspace/seeding-tool"
OUTPUT="$SCRIPT_DIR/scripts/collabstr-influencers.jsonl"
CHECKPOINT="$SCRIPT_DIR/scripts/.collabstr-influencers.checkpoint.json"
LOGS_DIR="$SCRIPT_DIR/logs"
PID_FILE="/tmp/collabstr-scraper.pid"
MILESTONE_LOG="/tmp/collabstr-milestone.log"
CHECK_INTERVAL=30  # seconds
LAST_MILESTONE=0

mkdir -p "$LOGS_DIR"

get_scraper_pid() {
  pgrep -f "scrape-collabstr.ts" | head -1
}

get_record_count() {
  wc -l < "$OUTPUT" 2>/dev/null || echo 0
}

log_milestone() {
  local count=$1
  local msg=$2
  local ts=$(date '+%Y-%m-%d %H:%M:%S')
  echo "[$ts] $msg (records: $count)" | tee -a "$MILESTONE_LOG"
}

start_scraper() {
  local log="$LOGS_DIR/collabstr-full-$(date +%Y%m%d-%H%M%S).log"
  echo "$log" > /tmp/collabstr-full-log-path
  cd "$SCRIPT_DIR"
  nohup npm run collabstr:scrape -- --start-page 1 --output scripts/collabstr-influencers.jsonl > "$log" 2>&1 &
  local pid=$!
  echo $pid > "$PID_FILE"
  log_milestone "$(get_record_count)" "SCRAPER STARTED (pid=$pid log=$log)"
  echo $pid
}

log_milestone "$(get_record_count)" "WATCHDOG STARTED"

while true; do
  scraper_pid=$(get_scraper_pid)
  count=$(get_record_count)

  # Milestone reporting every 500 records
  milestone_bucket=$(( count / 500 ))
  if [ "$milestone_bucket" -gt "$LAST_MILESTONE" ]; then
    LAST_MILESTONE=$milestone_bucket
    log_milestone "$count" "MILESTONE: crossed $((milestone_bucket * 500)) records"
  fi

  if [ -z "$scraper_pid" ]; then
    log_milestone "$count" "SCRAPER NOT RUNNING — restarting from checkpoint"
    start_scraper
  fi

  sleep "$CHECK_INTERVAL"
done
