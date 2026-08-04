import ts from "typescript";

export interface ServerActionInfo {
  filePath: string;
  name: string;
  scope: "file" | "function";
  line: number;
}

export interface ServerActionScanResult {
  isFileDirective: boolean;
  actions: ServerActionInfo[];
}

/**
 * AST-based Server Action Detector using TypeScript Compiler API.
 * Accurately parses AST nodes to find file-level and function-level "use server" directives,
 * ignoring directive text contained inside comments or string literals.
 */
export function detectServerActions(code: string, filePath = "file.ts"): ServerActionScanResult {
  const sourceFile = ts.createSourceFile(
    filePath,
    code,
    ts.ScriptTarget.Latest,
    true
  );

  let isFileDirective = false;
  const actions: ServerActionInfo[] = [];

  // Check top-level statements for "use server" directive
  for (const statement of sourceFile.statements) {
    if (ts.isExpressionStatement(statement)) {
      const expr = statement.expression;
      if (ts.isStringLiteral(expr) && expr.text === "use server") {
        isFileDirective = true;
        break;
      }
    }
  }

  function visit(node: ts.Node) {
    // Function declaration or function expression check
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node)
    ) {
      let isFunctionDirective = false;

      if (node.body && ts.isBlock(node.body)) {
        for (const statement of node.body.statements) {
          if (ts.isExpressionStatement(statement)) {
            const expr = statement.expression;
            if (ts.isStringLiteral(expr) && expr.text === "use server") {
              isFunctionDirective = true;
              break;
            }
          }
        }
      }

      if (isFunctionDirective || isFileDirective) {
        let name = "anonymous";
        if (ts.isFunctionDeclaration(node) && node.name) {
          name = node.name.text;
        } else if (node.parent && ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)) {
          name = node.parent.name.text;
        }

        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        actions.push({
          filePath,
          name,
          scope: isFunctionDirective ? "function" : "file",
          line,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return {
    isFileDirective,
    actions,
  };
}
