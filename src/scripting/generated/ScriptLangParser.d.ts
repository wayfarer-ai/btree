declare class ScriptLangParser {
  constructor(input: any);
  program(): any;
  removeErrorListeners(): void;
  addErrorListener(listener: any): void;
}
export default ScriptLangParser;
