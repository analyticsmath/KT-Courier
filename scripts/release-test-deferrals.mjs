import ts from "typescript";

function callRoot(node) {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node) || ts.isCallExpression(node) || ts.isParenthesizedExpression(node)) return callRoot(node.expression);
  return null;
}

/** Inspect nested Playwright/Vitest chains as well as direct skip declarations. */
export function hasTestDeferrals(source, file = "test.ts") {
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  let found = false;
  function inspect(node) {
    const property = ts.isPropertyAccessExpression(node) ? node.name.text : ts.isElementAccessExpression(node) && node.argumentExpression && ts.isStringLiteral(node.argumentExpression) ? node.argumentExpression.text : null;
    if (property && ["describe", "test", "it"].includes(callRoot(node.expression)) && /^(?:skip|skipIf|todo|fixme|only)$/.test(property)) found = true;
    if (ts.isIfStatement(node) && /safety\.ok/.test(node.expression.getText(parsed)) && /\breturn\b/.test(node.thenStatement.getText(parsed))) found = true;
    ts.forEachChild(node, inspect);
  }
  inspect(parsed);
  return found;
}

/** An exclusion requires the actual source constant, not a comment or env flag. */
export function hasDisabledSourceLock(source, constant) {
  const parsed = ts.createSourceFile("readiness.ts", source, ts.ScriptTarget.Latest, true);
  return parsed.statements.some((statement) => ts.isVariableStatement(statement) &&
    statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) &&
    (statement.declarationList.flags & ts.NodeFlags.Const) !== 0 &&
    statement.declarationList.declarations.some((declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === constant && declaration.initializer?.kind === ts.SyntaxKind.FalseKeyword));
}

export function isInactiveRecruitmentTest(file, readinessSource) {
  return /^tests\/phase26\/(?:e2e|integration)\//.test(file) && hasDisabledSourceLock(readinessSource, "RECRUITMENT_PRODUCTION_VALIDATION_APPROVED");
}
