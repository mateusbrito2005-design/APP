# Sistema simples de gestão de notas de alunos

# Função que cadastra as notas digitadas pelo usuário
def adicionar_notas():
    notas = []  # lista para guardar as notas
    qtd = int(input("Quantas notas deseja inserir? "))
    for i in range(qtd):  # repete para cada nota
        nota = float(input(f"Digite a nota {i + 1}: "))
        notas.append(nota)  # guarda a nota na lista
    return notas

# Função que calcula a média das notas
def calcular_media(notas):
    return sum(notas) / len(notas)

# Função que determina a situação do aluno
def determinar_situacao(media):
    if media >= 7:
        return "Aprovado"
    else:
        return "Reprovado"

# Função que mostra o relatório final
def exibir_relatorio(notas, media, situacao):
    print("\n----- RELATÓRIO FINAL -----")
    print("Notas inseridas:", notas)
    print(f"Média: {media:.2f}")
    print("Situação:", situacao)

# Programa principal
notas = adicionar_notas()
media = calcular_media(notas)
situacao = determinar_situacao(media)
exibir_relatorio(notas, media, situacao)
