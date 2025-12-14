#!/bin/bash

# Script to generate ANTLR parser for ScriptLang
# Generates JavaScript lexer, parser, and visitor from grammar

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TOOLS_DIR="$PROJECT_ROOT/tools"
ANTLR_JAR="$TOOLS_DIR/antlr-4.13.1-complete.jar"
GRAMMAR_FILE="$PROJECT_ROOT/src/scripting/ScriptLang.g4"
OUTPUT_DIR="$PROJECT_ROOT/src/scripting/generated"

echo "🔧 Generating ANTLR parser for ScriptLang..."

# Create tools directory if it doesn't exist
mkdir -p "$TOOLS_DIR"

# Download ANTLR jar if not present
if [ ! -f "$ANTLR_JAR" ]; then
    echo "📥 Downloading ANTLR 4.13.1..."
    curl -o "$ANTLR_JAR" https://www.antlr.org/download/antlr-4.13.1-complete.jar
    echo "✅ ANTLR downloaded successfully"
fi

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Generate parser
echo "⚙️  Generating parser from grammar..."
java -jar "$ANTLR_JAR" \
    -Dlanguage=JavaScript \
    -listener \
    -visitor \
    -o "$OUTPUT_DIR" \
    "$GRAMMAR_FILE"

echo "✅ Parser generation complete!"

# Generate TypeScript declaration files
echo "📝 Generating TypeScript declaration files..."

cat > "$OUTPUT_DIR/ScriptLangVisitor.d.ts" << 'EOF'
declare class ScriptLangVisitor {
  visit(ctx: any): any;
  visitChildren(ctx: any): any;
}
export default ScriptLangVisitor;
EOF

cat > "$OUTPUT_DIR/ScriptLangLexer.d.ts" << 'EOF'
declare class ScriptLangLexer {
  constructor(input: any);
}
export default ScriptLangLexer;
EOF

cat > "$OUTPUT_DIR/ScriptLangParser.d.ts" << 'EOF'
declare class ScriptLangParser {
  constructor(input: any);
  program(): any;
  removeErrorListeners(): void;
  addErrorListener(listener: any): void;
}
export default ScriptLangParser;
EOF

echo "✅ TypeScript declarations created!"
echo "📁 Generated files in: $OUTPUT_DIR"
