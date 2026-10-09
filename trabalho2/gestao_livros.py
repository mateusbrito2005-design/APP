# Sistema simples de gerenciamento de livros de uma biblioteca
import matplotlib.pyplot as plt  # biblioteca para gerar gráficos

# Passo 1: classe Livro com título, autor, gênero e quantidade disponível
class Livro:
    def __init__(self, titulo, autor, genero, quantidade):
        self.titulo = titulo
        self.autor = autor
        self.genero = genero
        self.quantidade = quantidade

# Passo 2: lista vazia para guardar os livros cadastrados
livros = []

# Passo 3: funções para gerenciar os livros

# Cadastra um novo livro e guarda na lista
def cadastrar_livro(titulo, autor, genero, quantidade):
    livro = Livro(titulo, autor, genero, quantidade)
    livros.append(livro)
    print(f"Livro '{titulo}' cadastrado com sucesso!")

# Lista todos os livros disponíveis
def listar_livros():
    print("\n----- LIVROS DISPONÍVEIS -----")
    if len(livros) == 0:
        print("Nenhum livro cadastrado.")
    for livro in livros:
        print(f"Título: {livro.titulo} | Autor: {livro.autor} | "
              f"Gênero: {livro.genero} | Quantidade: {livro.quantidade}")

# Busca um livro pelo título
def buscar_livro(titulo):
    for livro in livros:
        if livro.titulo.lower() == titulo.lower():
            print(f"\nLivro encontrado: {livro.titulo} - {livro.autor} "
                  f"({livro.genero}), quantidade: {livro.quantidade}")
            return livro
    print(f"\nLivro '{titulo}' não encontrado.")
    return None

# Passo 4: gráfico com a quantidade de livros por gênero
def gerar_grafico():
    generos = {}  # dicionário: gênero -> quantidade total
    for livro in livros:
        if livro.genero in generos:
            generos[livro.genero] += livro.quantidade
        else:
            generos[livro.genero] = livro.quantidade

    plt.bar(generos.keys(), generos.values(), color="skyblue")
    plt.title("Quantidade de livros por gênero")
    plt.xlabel("Gênero")
    plt.ylabel("Quantidade")
    plt.show()

# Passo 5: testando o sistema
cadastrar_livro("Dom Casmurro", "Machado de Assis", "Romance", 5)
cadastrar_livro("O Hobbit", "J.R.R. Tolkien", "Fantasia", 3)
cadastrar_livro("Harry Potter", "J.K. Rowling", "Fantasia", 4)
cadastrar_livro("Memórias Póstumas", "Machado de Assis", "Romance", 2)
cadastrar_livro("Sapiens", "Yuval Harari", "História", 6)

listar_livros()
buscar_livro("O Hobbit")
buscar_livro("Livro Inexistente")
gerar_grafico()
