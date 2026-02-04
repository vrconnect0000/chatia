function atualizar() {
    const html = document.getElementById("html-code").value;
    const css = "<style>" + document.getElementById("css-code").value + "</style>";
    const js = "<script>" + document.getElementById("js-code").value + "<\/script>";
    
    const frame = document.getElementById("resultado").contentWindow.document;

    frame.open();
    frame.write(html + css + js);
    frame.close();
}

// Inicia com um exemplo básico
window.onload = () => {
    document.getElementById("html-code").value = "<h1>Olá Mundo!</h1>\n<p>Edite o código acima para testar.</p>";
    document.getElementById("css-code").value = "body { text-align: center; font-family: sans-serif; padding-top: 50px; }\nh1 { color: #007acc; }";
    atualizar();
};