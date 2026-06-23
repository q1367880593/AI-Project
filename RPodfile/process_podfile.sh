#!/usr/bin/env bash
set -euo pipefail

input="${1:-Podfile}"
output="${2:-$input}"

if [[ ! -f "$input" ]]; then
  echo "Input file not found: $input" >&2
  exit 1
fi

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

ruby - "$input" > "$tmp" <<'RUBY'
input = ARGV.fetch(0)

local_paths = {
  "AJAgentShare" => "../../../../ajagentshare",
  "AJAgentLogin" => "../../../../ajagentlogin",
  "AJAgentFoundation" => "../../../../ajagentfoundation",
  "AJAgentChat" => "../../../../AJAgentChat"
}

git_pods = {
  "CBSAgentToolModule" => "pod \"CBSAgentToolModule\", :git => 'git@gitlab.it.5i5j.com:fnd/wiwork/wiworkmodulesios/cbsagenttoolmodule.git',:branch => 'develop'"
}

pod_pattern = /
  ^(?<indent>\s*)
  (?<comment>\#\s*)?
  pod\s*
  (?<quote>['"])
  (?<name>[^'"]+)
  \k<quote>
/x

lines = File.readlines(input, chomp: true).map do |line|
  line.gsub("http://gitlab.it.5i5j.com/fnd", "git@gitlab.it.5i5j.com:fnd")
end

found_path_line = Hash.new(false)
found_git_line = Hash.new(false)

lines = lines.map do |line|
  match = line.match(pod_pattern)
  next line unless match

  name = match[:name]
  indent = match[:indent]

  if local_paths.key?(name)
    path = local_paths.fetch(name)

    if line.include?(":path")
      if line.include?(path)
        found_path_line[name] = true
        line.sub(/^(\s*)#\s*/, "\\1")
      else
        line.start_with?("#{indent}#") ? line : "#{indent}##{line[indent.length..]}"
      end
    else
      line.start_with?("#{indent}#") ? line : "#{indent}##{line[indent.length..]}"
    end

  elsif git_pods.key?(name)
    git_line = git_pods.fetch(name)

    if line.include?(":git") && line.include?(":branch => 'develop'")
      found_git_line[name] = true
      git_line
    else
      line.start_with?("#{indent}#") ? line : "#{indent}##{line[indent.length..]}"
    end

  else
    line
  end
end

local_paths.each do |name, path|
  next if found_path_line[name]

  insert_at = lines.rindex { |line| line.match?(pod_pattern) && line.match(pod_pattern)[:name] == name }
  new_line = "pod '#{name}', :path => '#{path}'"

  if insert_at
    lines.insert(insert_at + 1, new_line)
  else
    lines << new_line
  end
end

git_pods.each do |name, git_line|
  next if found_git_line[name]

  insert_at = lines.rindex { |line| line.match?(pod_pattern) && line.match(pod_pattern)[:name] == name }

  if insert_at
    lines.insert(insert_at + 1, git_line)
  else
    lines << git_line
  end
end

puts lines
RUBY

mv "$tmp" "$output"
trap - EXIT

echo "Processed $input -> $output"
