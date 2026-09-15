import { type App, Modal, Setting } from "obsidian";

export class ImportModal extends Modal {
  private readonly onSubmit: (json: string) => Promise<boolean>;

  constructor(app: App, onSubmit: (json: string) => Promise<boolean>) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    this.setTitle("Import highlighters");
    const { contentEl } = this;

    contentEl.createEl("p", {
      text: "Paste exported highlighters, or the data.json file from the obsidian-dynamic-highlights plugin folder. Imported highlighters are added after the existing ones.",
    });

    const input = contentEl.createEl("textarea", {
      cls: "dth-import-input",
      attr: { placeholder: "[ { \"name\": \"...\", \"query\": \"...\" } ]", spellcheck: "false" },
    });

    new Setting(contentEl).addButton((button) =>
      button
        .setButtonText("Import")
        .setCta()
        .onClick(async () => {
          if (await this.onSubmit(input.value)) this.close();
        }),
    );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
