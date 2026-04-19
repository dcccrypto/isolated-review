export type Shell = 'bash' | 'zsh' | 'fish';

const COMMANDS = ['init', 'keys', 'settings', 'status', 'prompts', 'doctor', 'completion'];
const ALIASES  = ['claude', 'claude-sonnet', 'claude-opus', 'claude-haiku'];
const EFFORT   = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'];
const PROMPTS  = ['default', 'security', 'perf', 'refactor'];

export function completionScript(shell: Shell): string {
  if (shell === 'zsh')  return zsh();
  if (shell === 'bash') return bash();
  if (shell === 'fish') return fish();
  throw new Error(`unknown shell: ${shell}. supported: bash, zsh, fish`);
}

function zsh(): string {
  return `#compdef review

# isolated-review — zsh completion
# install with:
#   review completion zsh > ~/.zfunc/_review
#   (ensure ~/.zfunc is on fpath; add to .zshrc: fpath=(~/.zfunc $fpath) && autoload -Uz compinit && compinit)

_review() {
  local -a commands models efforts prompts

  commands=(
    'init:One-shot setup (API keys + default model)'
    'keys:Set API keys'
    'settings:Set the default review model'
    'status:Show current config'
    'prompts:Manage prompt presets'
    'doctor:Offline health check'
    'completion:Generate shell completion script'
  )
  models=(${ALIASES.map(a => `'${a}'`).join(' ')})
  efforts=(${EFFORT.map(e => `'${e}'`).join(' ')})
  prompts=(${PROMPTS.map(p => `'${p}'`).join(' ')})

  # If a user-prompts dir exists, include its entries too.
  local user_prompt_dir="\${IR_CONFIG_DIR:-$HOME/.config/isolated-review}/prompts"
  if [[ -d $user_prompt_dir ]]; then
    for f in $user_prompt_dir/*.md(N); do
      prompts+=("\${f:t:r}")
    done
  fi

  _arguments -s \\
    '--model[primary review model]:model:($models)' \\
    '--verify[second-pass verifier model]:model:($models)' \\
    '--prompt[named prompt preset]:prompt:($prompts)' \\
    '--prompt-file[ad-hoc prompt file]:path:_files -g "*.md"' \\
    '--effort[reasoning effort]:level:($efforts)' \\
    '--fail-on[exit 2 if findings >= severity]:severity:(critical medium low)' \\
    '--notes[extra context]:text:' \\
    '--diff[review only lines changed vs a git base]::base:' \\
    '--patch[include suggested patch ideas]' \\
    '--pick[interactive file picker]' \\
    '--copy[copy markdown summary to clipboard]' \\
    '--open[open first critical finding in editor]' \\
    '--json[emit machine-readable JSON]' \\
    '--plain[no color / no unicode]' \\
    '--last[rerun the previous review]' \\
    '-V --version' \\
    '-h --help' \\
    '1: :->cmd' \\
    '*: :_files'

  case $state in
    cmd)
      _describe -t subcommands 'review subcommand' commands
      ;;
  esac
}

compdef _review review
`;
}

function bash(): string {
  return `# isolated-review — bash completion
# install with:
#   review completion bash > ~/.bash_completion.d/review
#   echo 'source ~/.bash_completion.d/review' >> ~/.bashrc

_review() {
  local cur prev
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"

  local commands="init keys settings status prompts doctor completion"
  local models="${ALIASES.join(' ')}"
  local efforts="${EFFORT.join(' ')}"
  local prompts="${PROMPTS.join(' ')}"

  local user_prompt_dir="\${IR_CONFIG_DIR:-$HOME/.config/isolated-review}/prompts"
  if [ -d "$user_prompt_dir" ]; then
    for f in "$user_prompt_dir"/*.md; do
      [ -e "$f" ] || continue
      local base="\${f##*/}"
      prompts="$prompts \${base%.md}"
    done
  fi

  case "$prev" in
    --model|--verify) COMPREPLY=( $(compgen -W "$models" -- "$cur") ); return 0 ;;
    --prompt)         COMPREPLY=( $(compgen -W "$prompts" -- "$cur") ); return 0 ;;
    --effort)         COMPREPLY=( $(compgen -W "$efforts" -- "$cur") ); return 0 ;;
    --fail-on)        COMPREPLY=( $(compgen -W "critical medium low" -- "$cur") ); return 0 ;;
    --prompt-file)    COMPREPLY=( $(compgen -f -X '!*.md' -- "$cur") ); return 0 ;;
  esac

  if [ $COMP_CWORD -eq 1 ] && [[ "$cur" != -* ]]; then
    COMPREPLY=( $(compgen -W "$commands" -- "$cur") )
    return 0
  fi

  local opts="--model --verify --notes --patch --diff --effort --prompt --prompt-file --pick --copy --open --fail-on --json --plain --last --version --help"
  COMPREPLY=( $(compgen -W "$opts" -f -- "$cur") )
}

complete -F _review review
`;
}

function fish(): string {
  return `# isolated-review — fish completion
# install with:
#   review completion fish > ~/.config/fish/completions/review.fish

set -l commands init keys settings status prompts doctor completion
set -l models ${ALIASES.join(' ')}
set -l efforts ${EFFORT.join(' ')}
set -l prompts ${PROMPTS.join(' ')}

function __review_user_prompts
  set -l dir (set -q IR_CONFIG_DIR; and echo $IR_CONFIG_DIR; or echo $HOME/.config/isolated-review)/prompts
  if test -d $dir
    for f in $dir/*.md
      basename -s .md $f
    end
  end
end

complete -c review -n "__fish_use_subcommand" -a "$commands" -d "subcommand"

complete -c review -l model      -d "primary review model"           -x -a "$models"
complete -c review -l verify     -d "second-pass verifier model"     -x -a "$models"
complete -c review -l prompt     -d "named prompt preset"            -x -a "$prompts (__review_user_prompts)"
complete -c review -l prompt-file -d "ad-hoc prompt file"             -r -a "*.md"
complete -c review -l effort     -d "reasoning effort"               -x -a "$efforts"
complete -c review -l fail-on    -d "exit 2 if findings >= severity" -x -a "critical medium low"
complete -c review -l notes      -d "extra context" -x
complete -c review -l diff       -d "review only changes vs git base" -x
complete -c review -l patch      -d "include suggested patch ideas"
complete -c review -l pick       -d "interactive file picker"
complete -c review -l copy       -d "copy markdown summary to clipboard"
complete -c review -l open       -d "open first critical finding in editor"
complete -c review -l json       -d "emit machine-readable JSON"
complete -c review -l plain      -d "no color / no unicode"
complete -c review -l last       -d "rerun the previous review"
complete -c review -s V -l version -d "show version"
complete -c review -s h -l help    -d "show help"
`;
}

export async function runCompletion(shell: string): Promise<string> {
  const lower = shell.toLowerCase();
  if (lower !== 'bash' && lower !== 'zsh' && lower !== 'fish') {
    throw new Error(`unknown shell: ${shell}. supported: bash, zsh, fish`);
  }
  return completionScript(lower as Shell);
}
