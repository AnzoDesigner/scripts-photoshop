/*
@@@BUILDINFO@@@ Image Processor.jsx 1.2.0.3
*/

/*

// BEGIN__HARVEST_EXCEPTION_ZSTRING

<javascriptresource>
<name>$$$/JavaScripts/ImageProcessor/Menu=Image Processor...</name>
<category>aaaThisPutsMeAtTheTopOfTheMenu</category>
</javascriptresource>

// END__HARVEST_EXCEPTION_ZSTRING

*/

#target photoshop
app.bringToFront();

(function () {
    if (!app.documents.length) {
        alert("Abra um documento antes de rodar o script.");
        return;
    }

    var doc = app.activeDocument;

    // ====== AÇÃO GRAVADA (fixa) ======
    var ACTION_SET_NAME = "Ações Padrão";
    var ACTION_NAME     = "FatiarGuias";
    // =================================

    // =========================
    // ScriptUI: quantidade de colunas
    // =========================
    function askColumns(defaultValue) {
        var w = new Window("dialog", "Gerar guias + Executar ação (FatiarGuias)");
        w.alignChildren = "fill";

        var row = w.add("group");
        row.add("statictext", undefined, "Quantidade de colunas:");
        var input = row.add("edittext", undefined, String(defaultValue));
        input.characters = 6;

        var hint = w.add("statictext", undefined, "Inteiro ≥ 1. (N colunas → N−1 guias internas)");
        hint.graphics.font = ScriptUI.newFont(hint.graphics.font.name, "ITALIC", hint.graphics.font.size);

        var btns = w.add("group");
        btns.alignment = "right";
        var ok = btns.add("button", undefined, "OK");
        var cancel = btns.add("button", undefined, "Cancelar");

        function sanitizeAndValidate() {
            var t = input.text.replace(/[^\d]/g, "");
            input.text = t;

            if (!t.length) return { ok: false, value: null };
            var n = parseInt(t, 10);
            if (isNaN(n) || n < 1) return { ok: false, value: null };
            return { ok: true, value: n };
        }

        input.onChanging = function () {
            ok.enabled = sanitizeAndValidate().ok;
        };

        input.onKeyDown = function (k) {
            if (k.keyName === "Enter") {
                var r = sanitizeAndValidate();
                if (r.ok) w.close(1);
            }
        };

        ok.onClick = function () {
            var r = sanitizeAndValidate();
            if (!r.ok) {
                alert("Informe um número inteiro de colunas (≥ 1).");
                return;
            }
            w.close(1);
        };

        cancel.onClick = function () { w.close(0); };

        ok.enabled = sanitizeAndValidate().ok;

        if (w.show() !== 1) return null;
        var finalR = sanitizeAndValidate();
        return finalR.ok ? finalR.value : null;
    }

    var columns = askColumns(3);
    if (columns === null) return;

    // =========================
    // Helpers
    // =========================
    var originalRulerUnits = app.preferences.rulerUnits;
    app.preferences.rulerUnits = Units.PIXELS;

    function addV(xPx) {
        doc.guides.add(Direction.VERTICAL, new UnitValue(xPx, "px"));
    }

    function tryUnlockGuidesIfLocked() {
        // tenta destravar View > Lock Guides se estiver ativo (pra conseguir remover guias)
        try {
            var s2t = app.stringIDToTypeID;
            var ref = new ActionReference();
            ref.putEnumerated(s2t("menuItemClass"), s2t("menuItemType"), s2t("toggleLockGuides"));
            var desc = executeActionGet(ref);
            if (desc.hasKey(s2t("checked")) && desc.getBoolean(s2t("checked")) === true) {
                app.runMenuItem(s2t("toggleLockGuides"));
            }
        } catch (e) {
            // se não der pra detectar, segue
        }
    }

    // =========================
    // Execução
    // =========================
    try {
        var docW = doc.width.as("px");

        // 1) Remover guias existentes
        tryUnlockGuidesIfLocked();
        try {
            doc.guides.removeAll();
        } catch (e1) {
            // fallback: tenta toggle e remove de novo
            try {
                app.runMenuItem(app.stringIDToTypeID("toggleLockGuides"));
                doc.guides.removeAll();
            } catch (e2) {
                throw new Error("Não foi possível remover as guias existentes (verifique 'Lock Guides').");
            }
        }

        // 2) Criar guias verticais para colunas (N colunas -> N-1 guias internas)
        if (columns > 1) {
            var step = docW / columns;
            for (var c = 1; c < columns; c++) {
                addV(step * c);
            }
        }

        // 3) Executar ação gravada: Conjunto "Ações Padrão" > Ação "FatiarGuias"
        try {
            app.doAction(ACTION_NAME, ACTION_SET_NAME);
        } catch (eAction) {
            throw new Error(
                "Falha ao executar a ação.\n" +
                "Verifique se existe:\n" +
                "- Conjunto: \"" + ACTION_SET_NAME + "\"\n" +
                "- Ação: \"" + ACTION_NAME + "\"\n\n" +
                "Detalhe: " + eAction.message
            );
        }

        alert(
            "Concluído!\n" +
            "- Guias existentes: removidas\n" +
            "- Colunas: " + columns + " (guias internas: " + Math.max(columns - 1, 0) + ")\n" +
            "- Ação executada: " + ACTION_SET_NAME + " > " + ACTION_NAME
        );

    } catch (e) {
        alert("Erro: " + e.message);
    } finally {
        app.preferences.rulerUnits = originalRulerUnits;
    }
})();
