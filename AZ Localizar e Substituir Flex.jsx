#target photoshop

function main() {
    if (app.documents.length === 0) {
        alert("Por favor, abra um documento primeiro.");
        return;
    }

    // --- INTERFACE ---
    var win = new Window("dialog", "Substituição Flexível");
    win.orientation = "column";
    win.alignChildren = ["fill", "top"];
    win.spacing = 10;
    win.margins = 16;

    // Busca
    win.add("statictext", undefined, "Localizar:");
    var txtFind = win.add("edittext", [0, 0, 300, 80], "", {multiline: true, wantReturn: true});
    
    // Substituição
    win.add("statictext", undefined, "Substituir por:");
    var txtRep = win.add("edittext", [0, 0, 300, 80], "", {multiline: true, wantReturn: true});

    // Checkbox Flexibilidade
    var chkFlex = win.add("checkbox", undefined, "Ignorar espaços ao redor da quebra de linha");
    chkFlex.value = true; // Recomendado deixar marcado
    
    // Checkbox Case Sensitive
    var chkCase = win.add("checkbox", undefined, "Diferenciar Maiúsculas/Minúsculas");
    chkCase.value = false;

    // Botões
    var grpBtns = win.add("group");
    grpBtns.alignment = "right";
    var btnCancel = grpBtns.add("button", undefined, "Cancelar");
    var btnOk = grpBtns.add("button", undefined, "Substituir");

    btnCancel.onClick = function() { win.close(); }

    btnOk.onClick = function() {
        if (txtFind.text.length === 0) return;
        win.close();
        processar(txtFind.text, txtRep.text, chkFlex.value, chkCase.value);
    }

    // --- LÓGICA ---
    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
    }

    function processar(busca, substituicao, usarFlexibilidade, matchCase) {
        var doc = app.activeDocument;
        var count = 0;
        var regexBusca;

        // 1. PREPARAÇÃO DA BUSCA
        if (usarFlexibilidade) {
            // Divide o texto de busca onde houver quebra de linha
            // Ex: ["Black ", " Friday!"]
            var linhas = busca.split(/[\r\n]+/);
            var partesEscapadas = [];
            
            // Limpa espaços nas pontas de cada linha da BUSCA para garantir match
            for (var k=0; k < linhas.length; k++) {
                // Remove espaços do final da linha e do começo da próxima para criar o regex flexível
                var limpo = linhas[k].replace(/^\s+|\s+$/g, ''); 
                if (limpo.length > 0) partesEscapadas.push(escapeRegExp(limpo));
            }

            // Cria um regex que aceita: texto + (espaços opcionais + quebra de linha + espaços opcionais) + texto
            // O padrão \\s*[\\r\\n]+\\s* significa: "Qualquer espaço, seguido de Enter, seguido de qualquer espaço"
            var patternStr = partesEscapadas.join("\\s*[\\r\\n]+\\s*");
            regexBusca = new RegExp(patternStr, matchCase ? "g" : "gi");
        } else {
            // Busca Exata (Antiga)
            var buscaNorm = busca.replace(/\r\n|\n|\r/g, "\r");
            regexBusca = new RegExp(escapeRegExp(buscaNorm), matchCase ? "g" : "gi");
        }

        // 2. PREPARAÇÃO DA SUBSTITUIÇÃO
        // Normaliza a substituição para usar apenas \r (padrão Photoshop)
        var substNorm = substituicao.replace(/\r\n|\n|\r/g, "\r");

        // 3. VARREDURA
        function processLayers(layers) {
            for (var i = 0; i < layers.length; i++) {
                var layer = layers[i];

                if (layer.typename == "LayerSet") {
                    processLayers(layer.layers);
                } else if (layer.kind == LayerKind.TEXT) {
                    try {
                        var conteudo = layer.textItem.contents;
                        
                        // Normaliza o conteúdo da camada para remover inconsistências de quebra de linha
                        // Mantemos os espaços, mas garantimos que o ENTER seja \r
                        var conteudoCheck = conteudo.replace(/\r\n|\n/g, "\r");

                        if (regexBusca.test(conteudoCheck)) {
                            layer.textItem.contents = conteudoCheck.replace(regexBusca, substNorm);
                            count++;
                        }
                    } catch(e) {}
                }
            }
        }

        doc.suspendHistory("Script Substituir Flex", "processLayers(doc.layers)");
    }

    win.center();
    win.show();
}

main();